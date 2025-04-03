// --- Constants ---
const DATA_URL = 'https://pikoow.github.io/VGCPastes-Finder/data/processed_data.json';
const SHOWDOWN_ITEMS_URL = "https://play.pokemonshowdown.com/data/items.js";
const SHOWDOWN_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.js";
const SHOWDOWN_ABILITIES_URL = "https://play.pokemonshowdown.com/data/abilities.js"; // Added for more complete ability list

// Size/Weight Thresholds (Decimetres for height, Hectograms for weight)
const SMALL_THRESHOLD_H = 5;   // <= 0.5m
const TALL_THRESHOLD_H = 20;   // >= 2.0m
const LIGHT_THRESHOLD_HG = 100;  // <= 10.0kg
const HEAVY_THRESHOLD_HG = 2000; // >= 200.0kg

// Scoring Weights (Adjust as needed)
const SCORE_WEIGHTS = {
    EXACT_POKEMON: 150,
    POKEMON_WITH_ITEM: 75,
    POKEMON_WITH_TERA: 75,
    POKEMON_WITH_ABILITY: 75,
    POKEMON_WITH_MOVE: 40,
    SIZE_REQUEST: 45,
    WEIGHT_REQUEST: 45,
    GENERAL_MOVE: 20,
    GENERAL_ABILITY: 25, // Slightly higher than move due to fewer abilities per team
    TYPE_ROLE_MATCH: 30,
    GENERAL_TYPE: 10,
    GENERAL_ROLE: 15,
    ARCHETYPE_HINT: 60, // Bonus for matching known archetypes/cores
    NEGATIVE_CONSTRAINT_PENALTY: -500 // Heavy penalty if a "without" constraint is violated
};

// Common Tera Types (Used for parsing and validation)
const TERA_TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy", "stellar"];

// Basic Archetype Keywords/Cores (Expandable)
const ARCHETYPES = {
    "rain": { keywords: ["rain", "drizzle", "swift swim"], cores: [["pelipper"], ["politoed"], ["urshifu-rapid-strike"]], boosts: ["water"] },
    "sun": { keywords: ["sun", "drought", "chlorophyll", "protosynthesis"], cores: [["torkoal"], ["venusaur"], ["walking wake"], ["gouging fire"]], boosts: ["fire", "grass"] },
    "trick room": { keywords: ["trick room", "tr"], cores: [["cresselia"], ["indeedee-f"], ["armarouge"], ["ursaluna"], ["torkoal"], ["hatterene"]], penalties: ["tailwind", "speedy"]},
    "tailwind": { keywords: ["tailwind", "twind"], cores: [["tornadus", "tornadus-therian"], ["whimsicott"], ["murkrow"]], boosts: ["speedy"]},
    "snow": { keywords: ["snow", "snow warning", "slush rush", "aurora veil"], cores: [["abomasnow"], ["ninetales-alola"], ["arctibax"]], boosts: ["ice"]},
    "sand": { keywords: ["sand", "sandstorm", "sand rush", "sand stream"], cores: [["tyranitar"], ["excadrill"], ["hippowdon"]], boosts: ["rock", "ground", "steel"]},
    "hyper offense": { keywords: ["hyper offense", "ho", "fast paced"], boosts: ["attacker", "special attacker", "speedy"]},
    "balance": { keywords: ["balance", "balanced", "standard"], boosts: [] },
    // Add more archetypes: Psychic Spam, Hard TR, Screens HO, etc.
};

// --- Data Service ---
const DataService = {
    rawData: null,
    pokemonIndex: new Map(), // lowercase name -> { originalCase: string, details: object }
    allItems: new Set(),
    allMoves: new Set(),
    allAbilities: new Set(),
    isInitialized: false,
    dataLoadedPromise: null,

    async initialize() {
        if (this.isInitialized) return;
        if (this.dataLoadedPromise) return this.dataLoadedPromise; // Prevent redundant initializations

        console.log("Initializing DataService...");
        this.dataLoadedPromise = this._loadAllData();
        try {
            await this.dataLoadedPromise;
            this.isInitialized = true;
            console.log("DataService Initialized.");
            // Log counts for verification
            console.log(`Loaded ${this.pokemonIndex.size} unique Pokémon.`);
            console.log(`Loaded ${this.allAbilities.size} unique abilities.`);
            console.log(`Loaded ${this.allMoves.size} unique moves.`);
            console.log(`Loaded ${this.allItems.size} unique items.`);
        } catch (error) {
            console.error("DataService initialization failed:", error);
            // Prevent partial initialization state
            this.isInitialized = false;
            this.rawData = null;
            this.pokemonIndex.clear();
            // etc.
        } finally {
            this.dataLoadedPromise = null; // Clear promise reference
        }
    },

    async _loadAllData() {
        // 1. Load processed data first (core requirement)
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`Failed to fetch processed data: ${response.status}`);
            this.rawData = await response.json();
            if (!this.rawData || !Array.isArray(this.rawData)) {
                 throw new Error("Processed data is invalid or empty.");
            }
            this._preprocessRawData();
        } catch (error) {
            console.error('Error loading processed data:', error);
            throw error; // Re-throw to be caught by the caller
        }

        // 2. Fetch supplemental data from Showdown (items, moves, abilities)
        // Use Promise.allSettled to continue even if one fetch fails
        const results = await Promise.allSettled([
            this._fetchShowdownData(SHOWDOWN_ITEMS_URL, 'BattleItems', this.allItems),
            this._fetchShowdownData(SHOWDOWN_MOVES_URL, 'BattleMovedex', this.allMoves),
            this._fetchShowdownData(SHOWDOWN_ABILITIES_URL, 'BattleAbilities', this.allAbilities)
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const url = [SHOWDOWN_ITEMS_URL, SHOWDOWN_MOVES_URL, SHOWDOWN_ABILITIES_URL][index];
                console.warn(`Failed to fetch or parse data from ${url}:`, result.reason);
            }
        });

        // 3. Final cleanup: Ensure lowercase and remove potential empty strings
        this.allItems = new Set([...this.allItems].map(i => i?.toLowerCase()).filter(Boolean));
        this.allMoves = new Set([...this.allMoves].map(m => m?.toLowerCase()).filter(Boolean));
        this.allAbilities = new Set([...this.allAbilities].map(a => a?.toLowerCase()).filter(Boolean));

         // Add aliases or common names if needed (example)
         if (this.pokemonIndex.has('urshifu')) {
            this.pokemonIndex.set('urshifu-rapid-strike', this.pokemonIndex.get('urshifu-rapid-strike') || this.pokemonIndex.get('urshifu'));
            this.pokemonIndex.set('urshifu-single-strike', this.pokemonIndex.get('urshifu-single-strike') || this.pokemonIndex.get('urshifu'));
         }
         // Add more aliases as necessary
    },

    _preprocessRawData() {
        if (!this.rawData) return;
        this.rawData.forEach(team => {
            team.pokemons.forEach(p => {
                if (p?.name) {
                    const lowerName = p.name.toLowerCase();
                    // Store original case and basic details for faster access
                    if (!this.pokemonIndex.has(lowerName)) {
                        this.pokemonIndex.set(lowerName, { originalCase: p.name, details: p }); // Store the whole pokemon object found first
                    }
                    // Add abilities from data
                    if (p.ability) this.allAbilities.add(p.ability.toLowerCase());
                    // Add moves from data
                    if (p.moves) {
                        p.moves.forEach(move => {
                            const moveName = (typeof move === 'object' ? move.name : move)?.toLowerCase();
                            if (moveName) this.allMoves.add(moveName);
                        });
                    }
                     // Add items from data
                     if (p.item) this.allItems.add(p.item.toLowerCase());
                }
            });
        });
    },

    async _fetchShowdownData(url, exportName, targetSet) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const text = await response.text();
            // More robust regex to find the export object, handling minor variations
            const dataRegex = new RegExp(`exports\\.${exportName}\\s*=\\s*({[\\s\\S]*?});`);
            const match = text.match(dataRegex);

            if (match && match[1]) {
                // This is safer than eval. We extract names using regex.
                const dataBlock = match[1];
                const nameRegex = /name:\s*"([^"]+)"/g;
                let nameMatch;
                while ((nameMatch = nameRegex.exec(dataBlock)) !== null) {
                    if (nameMatch[1]) {
                       targetSet.add(nameMatch[1]); // Add directly, will convert to lowercase later
                    }
                }
            } else {
                console.warn(`Could not find or parse ${exportName} data from ${url}.`);
            }
        } catch (error) {
            console.error(`Error fetching/parsing ${url}:`, error);
            // Don't throw here, let allSettled handle it so other fetches can complete
        }
    },

    // --- Public Accessors ---
    getTeams: () => DataService.rawData,
    getPokemonDetails: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.details,
    getOriginalCaseName: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.originalCase || name, // Fallback to input if not found
    isValidPokemon: (name) => DataService.pokemonIndex.has(name?.toLowerCase()),
    isValidItem: (name) => DataService.allItems.has(name?.toLowerCase()),
    isValidMove: (name) => DataService.allMoves.has(name?.toLowerCase()),
    isValidAbility: (name) => DataService.allAbilities.has(name?.toLowerCase()),
    getAllPokemonNamesLower: () => [...DataService.pokemonIndex.keys()],
    getAllItemsLower: () => [...DataService.allItems],
    getAllMovesLower: () => [...DataService.allMoves],
    getAllAbilitiesLower: () => [...DataService.allAbilities],
};

// --- Instruction Parser ---
const InstructionParser = {

    parse(instruction) {
        if (!DataService.isInitialized) {
            console.error("Parser called before DataService initialized.");
            return null; // Or throw error
        }
        if (!instruction || typeof instruction !== 'string') {
            return this._createEmptyParsedObject();
        }

        const lowerInstruction = instruction.toLowerCase();
        const parsed = this._createEmptyParsedObject();
        const words = lowerInstruction.split(/\s+/); // Simple split for now

        // --- Entity Recognition Strategy ---
        // 1. Find all *potential* mentions of known entities (pokemon, items, moves, abilities)
        // 2. Prioritize longer matches and specific keywords ("tera", "holding", "ability")
        // 3. Resolve overlaps and ambiguities (e.g., "Damp Rock")
        // 4. Assign remaining standalone terms if applicable

        const potentialEntities = this._findAllPotentialEntities(lowerInstruction);

        // Sort by position, then length (desc) to process longer matches first
        potentialEntities.sort((a, b) => {
            if (a.start !== b.start) return a.start - b.start;
            return b.end - a.end; // Longer comes first at the same start position
        });

        // --- Processing and Disambiguation ---
        const consumedIndices = new Set(); // Track parts of the string already assigned to an entity

        for (const entity of potentialEntities) {
            // Skip if this span overlaps with an already consumed (higher priority) entity
            if (this._isConsumed(entity.start, entity.end, consumedIndices)) {
                continue;
            }

            // Mark this span as consumed
            for (let i = entity.start; i < entity.end; i++) {
                consumedIndices.add(i);
            }

            // Add to parsed object based on type
            switch (entity.type) {
                case 'pokemon':
                    // Store original case name
                    parsed.pokemon.push(DataService.getOriginalCaseName(entity.value));
                    // Check context for item, ability, move, tera
                    this._parsePokemonContext(lowerInstruction, entity, parsed, consumedIndices);
                    break;
                case 'item':
                    // Check if context links it to a *nearby* unassigned Pokémon
                    // For now, add to general list if not directly linked in _parsePokemonContext
                    if (!parsed.pokemon_with_items.some(pi => pi.item === entity.value)) {
                       // Basic check: Is it preceded by "with" or "holding"?
                       const precedingText = lowerInstruction.substring(Math.max(0, entity.start - 15), entity.start);
                       if (!/\b(?:with|holding)\s+$/.test(precedingText)) {
                           // Likely a general item request if not following "with/holding"
                           // (More complex context checks could be added)
                           if (!parsed.items.includes(entity.value)) {
                                parsed.items.push(entity.value);
                           }
                       }
                       // Note: _parsePokemonContext handles the direct "Pokemon with item" case
                    }
                    break;
                case 'move':
                     // Add to general list if not directly linked in _parsePokemonContext
                    if (!parsed.pokemon_with_moves.some(pm => pm.move === entity.value) && !parsed.moves.includes(entity.value)) {
                         parsed.moves.push(entity.value);
                     }
                    break;
                case 'ability':
                     // Add to general list if not directly linked in _parsePokemonContext
                    if (!parsed.pokemon_with_abilities.some(pa => pa.ability === entity.value) && !parsed.abilities.includes(entity.value)) {
                        parsed.abilities.push(entity.value);
                     }
                    break;
                case 'tera':
                    // Usually handled by _parsePokemonContext, but catch general mentions
                    if (!parsed.pokemon_with_tera.some(pt => pt.tera_type === entity.value) && !parsed.tera_types.includes(entity.value)) {
                         parsed.tera_types.push(entity.value);
                    }
                    break;
                 case 'size': // Handle size/weight extracted earlier
                 case 'weight':
                     parsed[`${entity.type}_requests`].push(entity.value); // value is { type, count }
                     break;
                 case 'role':
                      if (!parsed.roles.includes(entity.value)) {
                          parsed.roles.push(entity.value);
                      }
                      // TODO: Link role to nearby type if applicable
                      break;
                 case 'type': // General type mention
                     if (!parsed.types.includes(entity.value) && !parsed.types_with_roles.some(tr => tr.type === entity.value)) {
                         parsed.types.push(entity.value);
                     }
                     break;
                 case 'archetype':
                     if (!parsed.archetype_hints.includes(entity.key)) {
                        parsed.archetype_hints.push(entity.key); // Store the archetype key ('rain', 'sun')
                     }
                     break;
                 case 'negation': // Handle "without X"
                     parsed.negations.push(entity.value); // value = { type: 'pokemon'|'item'|..., value: string }
                     break;
            }
        }

        // Final cleanup: Remove duplicates from lists
        for (const key in parsed) {
            if (Array.isArray(parsed[key]) && key !== 'pokemon_with_items' && key !== 'pokemon_with_tera' /* etc. keep objects unique */) {
                 // Simple uniqueness for primitives
                 if (parsed[key].length > 0 && typeof parsed[key][0] !== 'object') {
                      parsed[key] = [...new Set(parsed[key])];
                 }
                 // Could add custom logic for object uniqueness if needed
            }
        }

        return parsed;
    },

    _createEmptyParsedObject() {
        return {
            pokemon: [], // List of original case Pokémon names requested
            pokemon_with_items: [], // { pokemon: string (original case), item: string (lower) }
            pokemon_with_tera: [], // { pokemon: string (original case), tera_type: string (lower) }
            pokemon_with_abilities: [], // { pokemon: string (original case), ability: string (lower) }
            pokemon_with_moves: [], // { pokemon: string (original case), move: string (lower) }
            items: [], // General items requested (lower)
            moves: [], // General moves requested (lower)
            abilities: [], // General abilities requested (lower)
            tera_types: [], // General tera types requested (lower)
            types_with_roles: [], // { type: string (lower), role: string }
            types: [], // General types requested (lower)
            roles: [], // General roles requested (e.g., "attacker", "wall")
            size_requests: [], // { type: 'small' | 'tall', count: number }
            weight_requests: [], // { type: 'light' | 'heavy', count: number }
            archetype_hints: [], // List of archetype keys like 'rain', 'trick room'
            negations: [], // { type: 'pokemon' | 'item' | ..., value: string (lower) } - Things NOT wanted
        };
    },

     _findAllPotentialEntities(lowerInstruction) {
        const entities = [];
        const instructionLength = lowerInstruction.length;

        // --- Priority 1: Pokémon Names (Longest Match First) ---
        // Sort known names by length descending to find longer names first
        const sortedPokemonNames = DataService.getAllPokemonNamesLower().sort((a, b) => b.length - a.length);
        sortedPokemonNames.forEach(name => {
            const regex = new RegExp(`\\b${this._escapeRegex(name)}\\b`, 'g');
            let match;
            while ((match = regex.exec(lowerInstruction)) !== null) {
                 // Avoid matching substrings of already found longer names
                 if (!entities.some(e => e.type === 'pokemon' && match.index >= e.start && (match.index + name.length) <= e.end)) {
                    entities.push({ type: 'pokemon', value: name, start: match.index, end: match.index + name.length });
                 }
            }
        });

        // --- Priority 2: Multi-Word Items/Moves/Abilities (Longest First) ---
        const multiWordMatchers = [
             { type: 'item', list: DataService.getAllItemsLower() },
             { type: 'move', list: DataService.getAllMovesLower() },
             { type: 'ability', list: DataService.getAllAbilitiesLower() }
        ];

        multiWordMatchers.forEach(({ type, list }) => {
            const sortedList = list
                .filter(term => term.includes(' ')) // Only multi-word
                .sort((a, b) => b.length - a.length); // Longest first

            sortedList.forEach(term => {
                const regex = new RegExp(`\\b${this._escapeRegex(term)}\\b`, 'g');
                let match;
                while ((match = regex.exec(lowerInstruction)) !== null) {
                    // Basic check: Don't add if it overlaps exactly with a found Pokémon
                    if (!entities.some(e => e.type === 'pokemon' && e.start === match.index && e.end === (match.index + term.length))) {
                         entities.push({ type, value: term, start: match.index, end: match.index + term.length });
                    }
                }
            });
        });

         // --- Priority 3: Specific Keywords (Tera, Size, Weight, Roles, Without) ---
         // Tera Types (often follows Pokémon name or "tera")
         TERA_TYPES.forEach(tera => {
             const regex = new RegExp(`\\btera\\s+${this._escapeRegex(tera)}\\b`, 'g');
             let match;
             while ((match = regex.exec(lowerInstruction)) !== null) {
                 entities.push({ type: 'tera', value: tera, start: match.index + 5, end: match.index + 5 + tera.length }); // Position of the type itself
             }
             // Also look for "pokemon tera [type]" - handled in _parsePokemonContext
         });

         // Size/Weight Requests
         const sizeWeightRegex = /(\d+)\s+(small|tall|light|heavy)(?:\s+pokemon)?/gi;
         let swMatch;
         while ((swMatch = sizeWeightRegex.exec(lowerInstruction)) !== null) {
             const count = parseInt(swMatch[1], 10);
             const type = swMatch[2];
             if (!isNaN(count) && count > 0) {
                 const entityType = (type === 'small' || type === 'tall') ? 'size' : 'weight';
                 entities.push({ type: entityType, value: { type, count }, start: swMatch.index, end: swMatch.index + swMatch[0].length });
             }
         }

         // Roles (Keywords from Constants)
         // TODO: Implement role detection similar to other entities

         // Negations ("without", "no", "not including") - Basic Example
         const negationRegex = /\b(?:without|no|not including)\s+([a-z-]+(?:-[a-z]+)?)\b/g; // Matches "without [term]"
         let negMatch;
         while ((negMatch = negationRegex.exec(lowerInstruction)) !== null) {
             const term = negMatch[1];
             let termType = 'unknown';
             // Attempt to classify the negated term
             if (DataService.isValidPokemon(term)) termType = 'pokemon';
             else if (DataService.isValidItem(term)) termType = 'item';
             else if (DataService.isValidAbility(term)) termType = 'ability';
             else if (DataService.isValidMove(term)) termType = 'move';
             else if (TERA_TYPES.includes(term)) termType = 'type'; // Could be tera or general type

             entities.push({ type: 'negation', value: { type: termType, value: term }, start: negMatch.index, end: negMatch.index + negMatch[0].length });
         }

         // Archetypes
         for (const key in ARCHETYPES) {
             ARCHETYPES[key].keywords.forEach(keyword => {
                 const regex = new RegExp(`\\b${this._escapeRegex(keyword)}\\b`, 'g');
                 let match;
                 while ((match = regex.exec(lowerInstruction)) !== null) {
                     entities.push({ type: 'archetype', key: key, value: keyword, start: match.index, end: match.index + keyword.length });
                 }
             });
         }


         // --- Priority 4: Single-Word Items, Moves, Abilities, Types (Disambiguated) ---
        const singleWordMatchers = [
             { type: 'item', list: DataService.getAllItemsLower().filter(i => !i.includes(' ')) },
             { type: 'move', list: DataService.getAllMovesLower().filter(m => !m.includes(' ')) },
             { type: 'ability', list: DataService.getAllAbilitiesLower().filter(a => !a.includes(' ')) },
             { type: 'type', list: TERA_TYPES } // Treat general types similarly
        ];

        singleWordMatchers.forEach(({ type, list }) => {
             list.forEach(term => {
                 // Match whole word only
                 const regex = new RegExp(`\\b${this._escapeRegex(term)}\\b`, 'g');
                 let match;
                 while ((match = regex.exec(lowerInstruction)) !== null) {
                     // *** Crucial Disambiguation ***
                     // Check if this match is already part of a higher-priority entity found earlier
                     const isSubsumed = entities.some(e =>
                         e.start < (match.index + term.length) && // Entity starts before the term ends
                         e.end > match.index && // Entity ends after the term starts
                         (e.end - e.start) > term.length // Entity is longer than the term itself
                     );

                     if (!isSubsumed) {
                         // Also check if it's *exactly* overlapping a different entity type already logged
                         // (e.g., if "Rock" type overlaps with "Damp Rock" item, the item takes precedence)
                         const exactOverlap = entities.some(e => e.start === match.index && e.end === (match.index + term.length));
                         if (!exactOverlap) {
                            entities.push({ type, value: term, start: match.index, end: match.index + term.length });
                         }
                     }
                 }
             });
         });

        return entities;
    },

    _parsePokemonContext(lowerInstruction, pokemonEntity, parsed, consumedIndices) {
        const originalCasePokemon = DataService.getOriginalCaseName(pokemonEntity.value);
        let searchStart = pokemonEntity.end;
        let searchEnd = lowerInstruction.length;

        // Find the end of the relevant phrase for this Pokémon
        // Look for the next recognized Pokémon, or keywords indicating a break, or end of string
        const nextPokemon = parsed.pokemon.find(p => {
            const lowerP = p.toLowerCase();
            const index = lowerInstruction.indexOf(lowerP, searchStart);
            return index !== -1 && lowerP !== pokemonEntity.value; // Find the *next different* pokemon
        });
        if (nextPokemon) {
            searchEnd = lowerInstruction.indexOf(nextPokemon.toLowerCase(), searchStart);
        }
        // Could add other breaking keywords like "and a team with", etc.

        const contextText = lowerInstruction.substring(searchStart, searchEnd);

        // 1. Check for Tera Type: "pokemon tera [type]" or "[type] tera pokemon" (less common)
        TERA_TYPES.forEach(tera => {
            const teraRegex = new RegExp(`\\btera\\s+${this._escapeRegex(tera)}\\b`);
            if (teraRegex.test(contextText)) {
                 // Check if this tera type was already consumed by a general mention search
                 const teraEntityStart = searchStart + contextText.search(teraRegex);
                 const teraEntityEnd = teraEntityStart + `tera ${tera}`.length;
                 if (!this._isConsumed(teraEntityStart, teraEntityEnd, consumedIndices)) {
                     parsed.pokemon_with_tera.push({ pokemon: originalCasePokemon, tera_type: tera });
                      // Consume this specific "tera [type]" phrase part
                      for (let i = teraEntityStart; i < teraEntityEnd; i++) consumedIndices.add(i);
                      return; // Assume only one tera per pokemon context for simplicity
                 }
            }
        });

        // 2. Check for "with", "holding", "running", "using" followed by items, abilities, moves
        const withRegex = /\b(?:with|holding|running|using|ability|move)\b/g;
        let withMatch;
        let lastIndex = 0; // Start search within contextText

        while ((withMatch = withRegex.exec(contextText)) !== null) {
            const keyword = withMatch[0];
            const afterKeywordIndex = withMatch.index + keyword.length;
            // Extract text after the keyword until the next comma, "and", or end of context
            const potentialDetailMatch = contextText.substring(afterKeywordIndex).match(/^[\s,]+([^\,]*?)(?:\s*,|\s+and\b|\s*\.)/); // Non-greedy match until separator
             let detailText = potentialDetailMatch ? potentialDetailMatch[1].trim() : contextText.substring(afterKeywordIndex).trim().split(/\s*,|\s+and\b|\s*\./)[0]; // Fallback: take first part

             detailText = detailText.replace(/\.$/, '').trim(); // Clean trailing period

            if (detailText) {
                let foundDetail = false;
                const detailStart = searchStart + afterKeywordIndex + contextText.substring(afterKeywordIndex).search(/\S/); // Find actual start index in original string
                const detailEnd = detailStart + detailText.length;

                 // Prioritize based on keyword or entity type
                 if (keyword === 'ability' || DataService.isValidAbility(detailText)) {
                     if (DataService.isValidAbility(detailText) && !this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                        parsed.pokemon_with_abilities.push({ pokemon: originalCasePokemon, ability: detailText });
                        for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                        foundDetail = true;
                    }
                 }
                 // Check item next (common with "holding", "with")
                 else if ((keyword === 'holding' || keyword === 'with') && DataService.isValidItem(detailText)) {
                     if (!this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                        parsed.pokemon_with_items.push({ pokemon: originalCasePokemon, item: detailText });
                        for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                        foundDetail = true;
                    }
                 }
                 // Check move
                 else if ((keyword === 'move' || keyword === 'using' || keyword === 'running') && DataService.isValidMove(detailText)) {
                     if (!this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                        parsed.pokemon_with_moves.push({ pokemon: originalCasePokemon, move: detailText });
                        for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                        foundDetail = true; // Don't break, could list multiple moves
                    }
                 }
                 // Fallback check if no specific keyword was used (just "with")
                 else if (keyword === 'with') {
                     if (DataService.isValidItem(detailText) && !this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                         parsed.pokemon_with_items.push({ pokemon: originalCasePokemon, item: detailText });
                         for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                         foundDetail = true;
                     } else if (DataService.isValidAbility(detailText) && !this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                         parsed.pokemon_with_abilities.push({ pokemon: originalCasePokemon, ability: detailText });
                         for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                         foundDetail = true;
                     } else if (DataService.isValidMove(detailText) && !this._isConsumed(detailStart, detailEnd, consumedIndices)) {
                         parsed.pokemon_with_moves.push({ pokemon: originalCasePokemon, move: detailText });
                         for (let i = detailStart; i < detailEnd; i++) consumedIndices.add(i);
                         foundDetail = true;
                     }
                 }
            }
             // Prevent infinite loops if regex doesn't advance
             if (withRegex.lastIndex === lastIndex) break;
             lastIndex = withRegex.lastIndex;
        }
    },

     _isConsumed(start, end, consumedIndices) {
        for (let i = start; i < end; i++) {
            if (consumedIndices.has(i)) {
                return true;
            }
        }
        return false;
    },

    _escapeRegex(str) {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
};

// --- Team Matcher ---
const TeamMatcher = {

    calculateMatchScore(parsedInstruction, team) {
        if (!parsedInstruction || !team || !team.pokemons) {
            return 0;
        }

        let score = 0;
        const teamPokemonNames = team.pokemons.map(p => p?.name).filter(Boolean);
        const teamPokemonNamesLower = teamPokemonNames.map(name => name.toLowerCase());

        // --- Check Negations First (Heavy Penalty) ---
         for (const negation of parsedInstruction.negations) {
             let violated = false;
             switch (negation.type) {
                 case 'pokemon':
                     if (teamPokemonNamesLower.includes(negation.value)) violated = true;
                     break;
                 case 'item':
                     if (team.pokemons.some(p => p?.item?.toLowerCase() === negation.value)) violated = true;
                     break;
                 case 'ability':
                      if (team.pokemons.some(p => p?.ability?.toLowerCase() === negation.value)) violated = true;
                      break;
                 case 'move':
                      if (team.pokemons.some(p => p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === negation.value))) violated = true;
                      break;
                 case 'type': // Check if any pokemon has this type
                     if (team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(negation.value))) violated = true;
                     break;
                 // Add other negation types if needed
             }
             if (violated) {
                 score += SCORE_WEIGHTS.NEGATIVE_CONSTRAINT_PENALTY;
                 // Potentially return early if a strong negation is violated?
                 // return score; // Or just apply penalty and continue matching other things
             }
         }
         // Prevent further positive scoring if a strong negation makes the team invalid
         if (score <= SCORE_WEIGHTS.NEGATIVE_CONSTRAINT_PENALTY) {
             // return score; // Optionally stop here
         }


        // --- Positive Matches ---

        // 1. Exact Pokémon Presence
        parsedInstruction.pokemon.forEach(requestedPokemonName => {
            if (teamPokemonNames.includes(requestedPokemonName)) { // Match original case
                score += SCORE_WEIGHTS.EXACT_POKEMON;
            }
            // Optional: Add partial score for base form if evolution/variant requested? (e.g., request Urshifu, match Urshifu-Rapid-Strike)
        });

        // 2. Pokémon with Specifics (Item, Tera, Ability, Move)
        parsedInstruction.pokemon_with_items.forEach(({ pokemon, item }) => {
            if (team.pokemons.some(p => p?.name === pokemon && p?.item?.toLowerCase() === item)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_ITEM;
            }
        });
        parsedInstruction.pokemon_with_tera.forEach(({ pokemon, tera_type }) => {
            if (team.pokemons.some(p => p?.name === pokemon && p?.tera_type?.toLowerCase() === tera_type)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_TERA;
            }
        });
        parsedInstruction.pokemon_with_abilities.forEach(({ pokemon, ability }) => {
            if (team.pokemons.some(p => p?.name === pokemon && p?.ability?.toLowerCase() === ability)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_ABILITY;
            }
        });
        parsedInstruction.pokemon_with_moves.forEach(({ pokemon, move }) => {
            if (team.pokemons.some(p => p?.name === pokemon && p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === move))) {
                score += SCORE_WEIGHTS.POKEMON_WITH_MOVE;
            }
        });

        // 3. Size/Weight Requests
        parsedInstruction.size_requests.forEach(req => {
            const count = team.pokemons.filter(p => p?.height !== null && p?.height !== undefined &&
                ((req.type === 'small' && p.height <= SMALL_THRESHOLD_H) || (req.type === 'tall' && p.height >= TALL_THRESHOLD_H))
            ).length;
            if (count >= req.count) {
                score += SCORE_WEIGHTS.SIZE_REQUEST;
            } // Optional: Partial score if close?
        });
        parsedInstruction.weight_requests.forEach(req => {
             const count = team.pokemons.filter(p => p?.weight !== null && p?.weight !== undefined &&
                 ((req.type === 'light' && p.weight <= LIGHT_THRESHOLD_HG) || (req.type === 'heavy' && p.weight >= HEAVY_THRESHOLD_HG))
             ).length;
            if (count >= req.count) {
                score += SCORE_WEIGHTS.WEIGHT_REQUEST;
            }
        });

        // 4. General Item/Move/Ability/Tera Presence
        parsedInstruction.items.forEach(item => {
            if (team.pokemons.some(p => p?.item?.toLowerCase() === item)) {
                // Lower score than specific pokemon+item
                score += SCORE_WEIGHTS.POKEMON_WITH_ITEM / 3; // Example fraction
            }
        });
        parsedInstruction.moves.forEach(move => {
            if (team.pokemons.some(p => p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === move))) {
                score += SCORE_WEIGHTS.GENERAL_MOVE;
            }
        });
        parsedInstruction.abilities.forEach(ability => {
            if (team.pokemons.some(p => p?.ability?.toLowerCase() === ability)) {
                score += SCORE_WEIGHTS.GENERAL_ABILITY;
            }
        });
         parsedInstruction.tera_types.forEach(tera => {
             if (team.pokemons.some(p => p?.tera_type?.toLowerCase() === tera)) {
                 score += SCORE_WEIGHTS.POKEMON_WITH_TERA / 3; // Example fraction
             }
         });

        // 5. Type / Role / Archetype Matching
        // Basic Role Check (using stats - thresholds can be refined)
        const checkRole = (p, role) => {
             const stats = p?.stats;
             if (!stats) return false;
             // Use includes for flexibility (e.g., "strong attacker" includes "attacker")
             if ((role.includes("attack") || role.includes("physical")) && stats.attack >= 115) return true;
             if ((role.includes("special attack") || role.includes("special attacker")) && stats['special-attack'] >= 115) return true;
             if ((role.includes("defen") || role.includes("physical defense")) && stats.defense >= 105) return true;
             if ((role.includes("special defense") || role.includes("specially defensive")) && stats['special-defense'] >= 105) return true;
             if ((role.includes("speed") || role.includes("fast")) && stats.speed >= 105) return true;
             if ((role.includes("bulk") || role.includes("hp") || role.includes("health")) && stats.hp >= 100) return true;
             if (role.includes("wall") && (stats.defense >= 115 || stats['special-defense'] >= 115)) return true;
             return false;
        };

        parsedInstruction.roles.forEach(role => {
            if (team.pokemons.some(p => checkRole(p, role))) {
                score += SCORE_WEIGHTS.GENERAL_ROLE;
            }
        });

        parsedInstruction.types.forEach(type => {
            if (team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(type))) {
                score += SCORE_WEIGHTS.GENERAL_TYPE;
            }
        });

        parsedInstruction.types_with_roles.forEach(tr => {
             if (team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(tr.type) && checkRole(p, tr.role))) {
                 score += SCORE_WEIGHTS.TYPE_ROLE_MATCH;
             }
         });

         // Archetype Hints
         parsedInstruction.archetype_hints.forEach(hintKey => {
              const archetype = ARCHETYPES[hintKey];
              if (archetype) {
                  // Check for core pokemon presence
                  if (archetype.cores?.some(coreSet => coreSet.every(coreMon => teamPokemonNamesLower.includes(coreMon)))) {
                       score += SCORE_WEIGHTS.ARCHETYPE_HINT;
                  }
                  // Check for boosted types/roles
                  if (archetype.boosts?.some(boost => {
                      if (TERA_TYPES.includes(boost)) { // It's a type
                          return team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(boost));
                      } else { // It's a role
                           return team.pokemons.some(p => checkRole(p, boost));
                      }
                  })) {
                      score += SCORE_WEIGHTS.ARCHETYPE_HINT / 3; // Smaller bonus for general synergy
                  }
                  // Check for penalties (e.g., don't want tailwind on trick room)
                  if (archetype.penalties?.some(penalty => {
                       // Check if team has the penalized element
                       if (DataService.isValidMove(penalty) && team.pokemons.some(p => p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === penalty))) return true;
                       if (DataService.isValidAbility(penalty) && team.pokemons.some(p => p?.ability?.toLowerCase() === penalty)) return true;
                       // Add checks for penalized roles ('speedy') if needed
                       return false; // Default false if no penalty found
                    })) {
                        score -= SCORE_WEIGHTS.ARCHETYPE_HINT / 2; // Penalty for conflicting elements
                    }
              }
          });

        return Math.max(0, score); // Ensure score doesn't go negative unless due to penalty
    }
};

// --- Generator ---
const Generator = {

    async findMatchingTeams(instruction) {
        console.log("Starting team generation for:", instruction);
        // 1. Ensure data is ready
        await DataService.initialize();
        if (!DataService.isInitialized || !DataService.getTeams()) {
            console.error("Data service not ready, cannot generate teams.");
            // Return a specific error state if desired
            return [[], true, "Data failed to load."]; // [teams, noDetect, errorMessage]
        }

        // 2. Parse the instruction
        let parsedInstruction;
        try {
            parsedInstruction = InstructionParser.parse(instruction);
            if (!parsedInstruction) throw new Error("Parsing failed.");
            console.log("Parsed Instruction:", JSON.stringify(parsedInstruction, null, 2)); // Pretty print parsed object
        } catch (error) {
            console.error("Error parsing instruction:", error);
            return [[], true, "Could not understand the request."];
        }

        // 3. Score all available teams
        const teams = DataService.getTeams();
        const scoredTeams = teams.map((team, index) => {
             try {
                 const score = TeamMatcher.calculateMatchScore(parsedInstruction, team);
                 return { team, score, index };
             } catch (error) {
                 console.error(`Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error);
                 return { team, score: 0, index }; // Assign score 0 if error occurs
             }
         });

        // 4. Filter out teams with non-positive scores and sort by score descending
        const validScoredTeams = scoredTeams.filter(st => st.score > 0);
        validScoredTeams.sort((a, b) => b.score - a.score); // Highest score first

        // Log top scores for debugging
         // console.log("Top Scores:", validScoredTeams.slice(0, 10).map(st => ({ filename: st.team.filename, score: st.score })));

        // 5. Determine "no detection" and select best teams
        const maxScore = validScoredTeams.length > 0 ? validScoredTeams[0].score : 0;
        // Adjust threshold? Maybe require a minimum score > 10 or something?
        const noDetect = maxScore <= 0; // Or maxScore < MINIMUM_RELEVANT_SCORE

        console.log("Max Score:", maxScore, "No Detect:", noDetect);

        // Select teams with the maximum score (or maybe top N teams?)
        // Let's return all teams with the highest score for now
        const bestTeamsRaw = noDetect ? [] : validScoredTeams.filter(st => st.score === maxScore);

        // 6. Format the output
        const simplifiedTeams = bestTeamsRaw.map(st => this._simplifyTeamData(st.team));

        return [simplifiedTeams, noDetect, null]; // [teams, noDetect, errorMessage]
    },

    _simplifyTeamData(team) {
        // Similar to original, but ensure robustness
        return {
            filename: team.filename || "unknown_filename",
            pokemons: (team.pokemons || []).map(p => {
                if (!p || !p.name) return null; // Skip invalid pokemon entries

                const moves = Array.isArray(p.moves) ? p.moves : [];

                return {
                    name: p.name, // Keep original case
                    ability: p.ability || null,
                    item: p.item || null,
                    moves: moves.slice(0, 4).map(m => {
                        if (typeof m === 'object' && m?.name) {
                            return { name: m.name, type: m.type || 'unknown' };
                        } else if (typeof m === 'string') {
                            return { name: m, type: 'unknown' }; // Assume unknown type if only name is present
                        }
                        return null; // Skip invalid move formats
                    }).filter(Boolean), // Remove nulls
                    tera_type: p.tera_type || null,
                    sprite: p.sprites?.front_default || null // Use default sprite
                    // Optionally include stats if needed for display:
                    // stats: p.stats || null,
                    // types: p.types || [],
                    // height: p.height,
                    // weight: p.weight,
                };
            }).filter(Boolean) // Filter out any null pokemon results
        };
    }
};

// --- Global Exposure ---
// Expose a single, clean function to the outside world.
window.generatePokepaste = async function(instruction) {
    // We wrap the Generator call in an async function for consistency,
    // even though initialize handles the await internally.
    // This returns the [simplifiedTeams, noDetect, errorMessage] array.
    return await Generator.findMatchingTeams(instruction);
};

// Optional: Initialize data service automatically on script load
// This starts loading data immediately so it's likely ready when the user inputs text.
DataService.initialize().catch(err => {
     console.error("Automatic DataService initialization failed on load:", err);
     // Maybe display a user-facing error?
});