// --- Constants ---
const DATA_URL = 'https://pikoow.github.io/VGCPastes-Finder/data/processed_data.json';
const SHOWDOWN_ITEMS_URL = "https://play.pokemonshowdown.com/data/items.js";
const SHOWDOWN_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.js";
const SHOWDOWN_ABILITIES_URL = "https://play.pokemonshowdown.com/data/abilities.js";

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
    ARCHETYPE_HINT: 60,
    NEGATIVE_CONSTRAINT_PENALTY: -500
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

        /*console.log("Initializing DataService...");*/
        this.dataLoadedPromise = this._loadAllData();
        try {
            await this.dataLoadedPromise;
            this.isInitialized = true;
            /*console.log("DataService Initialized.");*/
            // Log counts for verification
            /*console.log(`Loaded ${this.pokemonIndex.size} unique Pokémon.`);
            console.log(`Loaded ${this.allAbilities.size} unique abilities.`);
            console.log(`Loaded ${this.allMoves.size} unique moves.`);
            console.log(`Loaded ${this.allItems.size} unique items.`);*/
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
                 case 'negation': // Handle "without X"
                     // Ensure we don't add duplicate negations (e.g., if regex accidentally matched overlapping parts)
                     if (!parsed.negations.some(neg => neg.type === entity.value.type && neg.value === entity.value.value)) {
                         parsed.negations.push(entity.value); // value = { type: 'pokemon'|'item'|..., value: string }
                     }
                     break;
                case 'archetype': // Handle archetype hints
                    // Could add to a specific list or just use for scoring hints later
                    // For now, just acknowledge it was found. Can refine later.
                    // Example: parsed.archetype_hints.push(entity.key);
                    break;
            }
        }

        // Final cleanup: Remove duplicates from lists
        for (const key in parsed) {
            if (Array.isArray(parsed[key]) && key !== 'pokemon_with_items' && key !== 'pokemon_with_tera' /* etc. keep objects unique */ && key !== 'negations' && key !== 'size_requests' && key !== 'weight_requests' && key !== 'types_with_roles') {
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
            negations: [], // { type: 'pokemon' | 'item' | ..., value: string (lower) } - Things NOT wanted
            // archetype_hints: [], // Optional: To store detected archetypes
        };
    },

    _findAllPotentialEntities(lowerInstruction) {
        const entities = [];
        const instructionLength = lowerInstruction.length;

        // --- Priority 1: Pokémon Names (Longest Match First) ---
        // Sort known names by length descending to find longer names first
        const sortedPokemonNames = DataService.getAllPokemonNamesLower().sort((a, b) => b.length - a.length);
        sortedPokemonNames.forEach(name => {
            // Use word boundaries that account for hyphens
            const regex = new RegExp(`(?<=^|\\s|\\()${this._escapeRegex(name)}(?=$|\\s|\\)|,|\\.)`, 'g');
            let match;
            while ((match = regex.exec(lowerInstruction)) !== null) {
                 // Avoid matching substrings of already found longer names at the same position
                 if (!entities.some(e => e.type === 'pokemon' && match.index >= e.start && (match.index + name.length) <= e.end && e.start === match.index)) {
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
                // Consider multi-word OR hyphenated as complex terms requiring this priority
                .filter(term => term.includes(' ') || term.includes('-'))
                .sort((a, b) => b.length - a.length); // Longest first

            sortedList.forEach(term => {
                // Use word boundaries that account for hyphens
                const regex = new RegExp(`(?<=^|\\s|\\()${this._escapeRegex(term)}(?=$|\\s|\\)|,|\\.)`, 'g');
                let match;
                while ((match = regex.exec(lowerInstruction)) !== null) {
                    // Basic check: Don't add if it overlaps exactly with a found Pokémon
                    if (!entities.some(e => e.type === 'pokemon' && e.start === match.index && e.end === (match.index + term.length))) {
                         // Check if already subsumed by a longer entity of the same type
                         if (!entities.some(e => e.type === type && match.index >= e.start && (match.index + term.length) <= e.end && e.start === match.index)) {
                              entities.push({ type, value: term, start: match.index, end: match.index + term.length });
                         }
                    }
                }
            });
        });

        // --- Priority 3: Specific Keywords (Tera, Size, Weight, Roles, Without, Archetypes) ---
        // Tera Types (often follows Pokémon name or "tera")
        TERA_TYPES.forEach(tera => {
            // Match "tera [type]" or "[type] tera"
            const regex = new RegExp(`\\b(?:tera\\s+${this._escapeRegex(tera)}|${this._escapeRegex(tera)}\\s+tera)\\b`, 'gi');
            let match;
            while ((match = regex.exec(lowerInstruction)) !== null) {
                // Find the actual position of the tera type word itself within the match
                const typeIndex = match[0].indexOf(tera);
                if(typeIndex !== -1) {
                   entities.push({ type: 'tera', value: tera, start: match.index + typeIndex, end: match.index + typeIndex + tera.length });
                }
            }
            // Direct association like "pokemon tera [type]" is handled in _parsePokemonContext
        });

        // Size/Weight Requests
        const sizeWeightRegex = /(\d+)\s+(small|tall|light|heavy)(?:\s+pokemon)?/gi;
        let swMatch;
        while ((swMatch = sizeWeightRegex.exec(lowerInstruction)) !== null) {
            const count = parseInt(swMatch[1], 10);
            const type = swMatch[2].toLowerCase(); // Ensure lowercase type
            if (!isNaN(count) && count > 0) {
                const entityType = (type === 'small' || type === 'tall') ? 'size' : 'weight';
                entities.push({ type: entityType, value: { type, count }, start: swMatch.index, end: swMatch.index + swMatch[0].length });
            }
        }

        // Roles (Keywords from Constants) - Needs implementation if roles beyond stats are needed


        // Negations ("without", "no", "not including") - Handles multiple negations and multi-word items/moves
       // Updated Regex to capture multi-word terms after negation and stop at next negation
       const negationRegex = /\b(?:without|no|not including)\s+([a-z0-9]+(?:(?:-|\s)(?!without\b|no\b|not including\b|and\b|or\b|with\b)[a-z0-9]+)*)\b/gi;
       let negMatch;
       while ((negMatch = negationRegex.exec(lowerInstruction)) !== null) {
           const term = negMatch[1].trim().toLowerCase(); // Capture, trim, and lowercase the term
           if (!term) continue; // Skip if term is empty after trim

           let termType = 'unknown';
           // Attempt to classify the negated term
           if (DataService.isValidPokemon(term)) termType = 'pokemon';
           else if (DataService.isValidItem(term)) termType = 'item';
           else if (DataService.isValidAbility(term)) termType = 'ability';
           else if (DataService.isValidMove(term)) termType = 'move';
           else if (TERA_TYPES.includes(term)) termType = 'type'; // Could be tera or general type

           // Push the entity covering the whole "without term" phrase
           entities.push({
               type: 'negation',
               value: { type: termType, value: term },
               start: negMatch.index,
               end: negMatch.index + negMatch[0].length
           });
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
             { type: 'item', list: DataService.getAllItemsLower().filter(i => !i.includes(' ') && !i.includes('-')) },
             { type: 'move', list: DataService.getAllMovesLower().filter(m => !m.includes(' ') && !m.includes('-')) },
             { type: 'ability', list: DataService.getAllAbilitiesLower().filter(a => !a.includes(' ') && !a.includes('-')) },
             { type: 'type', list: TERA_TYPES } // Treat general types similarly
        ];

        singleWordMatchers.forEach(({ type, list }) => {
             list.forEach(term => {
                 // Match whole word only
                 const regex = new RegExp(`(?<=^|\\s|\\()${this._escapeRegex(term)}(?=$|\\s|\\)|,|\\.)`, 'g');
                 let match;
                 while ((match = regex.exec(lowerInstruction)) !== null) {
                     // *** Crucial Disambiguation ***
                     // Check if this match is already part of a higher-priority entity found earlier
                     const isSubsumed = entities.some(e =>
                         e.start < (match.index + term.length) && // Entity starts before the term ends
                         e.end > match.index && // Entity ends after the term starts
                         // Check if it's strictly longer OR if it's a multi-word entity covering this single word
                         ((e.end - e.start) > term.length || (e.value && (e.value.includes(' ') || e.value.includes('-'))))
                     );

                     if (!isSubsumed) {
                         // Also check if it's *exactly* overlapping a different entity type already logged
                         // (e.g., if "Rock" type overlaps with "Damp Rock" item, the item takes precedence)
                         // OR if it overlaps a negation phrase
                         const exactOverlap = entities.some(e => e.start === match.index && e.end === (match.index + term.length));
                         const overlapsNegation = entities.some(e => e.type === 'negation' && match.index >= e.start && (match.index + term.length) <= e.end);

                         if (!exactOverlap && !overlapsNegation) {
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
        const potentialEntitiesAfter = this._findAllPotentialEntities(lowerInstruction.substring(searchStart));
        const nextPokemonEntity = potentialEntitiesAfter.find(e => e.type === 'pokemon');

        if (nextPokemonEntity) {
            // Adjust searchEnd to be the start of the next Pokémon mention in the original string
            searchEnd = searchStart + nextPokemonEntity.start;
        }
        // Could add other breaking keywords like "and a team with", etc.

        const contextText = lowerInstruction.substring(searchStart, searchEnd);

        // 1. Check for Tera Type: "pokemon tera [type]" or "pokemon [type] tera"
        TERA_TYPES.forEach(tera => {
             // Look for " tera [type]" or " [type] tera" immediately after pokemon name (allow whitespace)
            const teraRegex = new RegExp(`^\\s*(?:tera\\s+${this._escapeRegex(tera)}|${this._escapeRegex(tera)}\\s+tera)\\b`, 'i');
            const match = contextText.match(teraRegex);
            if (match) {
                 // Find the start/end within the original string for consumption check
                 const teraEntityStart = searchStart + match.index + match[0].indexOf(tera);
                 const teraEntityEnd = teraEntityStart + tera.length;

                 // Check if this specific tera mention was already consumed by a general search or another context
                 if (!this._isConsumed(teraEntityStart, teraEntityEnd, consumedIndices)) {
                     parsed.pokemon_with_tera.push({ pokemon: originalCasePokemon, tera_type: tera });
                      // Consume the matched part (e.g., " tera steel") in the original string indices
                      for (let i = searchStart + match.index; i < searchStart + match.index + match[0].length; i++) consumedIndices.add(i);
                      return; // Assume only one tera per pokemon context for simplicity
                 }
            }
        });

        // 2. Check for "with", "holding", "running", "using", ability/move keywords followed by items, abilities, moves
        // Regex to find keywords indicating a detail follows
        const detailKeywordRegex = /\b(?:with|holding|running|using|ability|move)\b/gi;
        let keywordMatch;
        let lastIndexInContext = 0;

        while ((keywordMatch = detailKeywordRegex.exec(contextText)) !== null) {
            const keyword = keywordMatch[0].toLowerCase();
            const afterKeywordIndexInContext = keywordMatch.index + keyword.length;
            // Extract text immediately following the keyword, looking for known entities
            // This is complex; simplify by checking the next few words
             const remainingContext = contextText.substring(afterKeywordIndexInContext).trimStart();
            if (!remainingContext) continue; // Nothing follows the keyword

            // Find potential items/abilities/moves starting right after the keyword
            const potentialDetails = this._findAllPotentialEntities(remainingContext);
            // Filter details that start near the beginning of the remaining context
            const relevantDetails = potentialDetails.filter(d => d.start <= 5 && (d.type === 'item' || d.type === 'ability' || d.type === 'move'));
             // Sort by start position, then length desc to prioritize longer matches first
             relevantDetails.sort((a,b) => a.start - b.start || b.end - a.end);

            if (relevantDetails.length > 0) {
                const detail = relevantDetails[0]; // Take the best match starting soon after keyword
                const detailValue = detail.value; // lower case value
                const detailType = detail.type; // item, ability, or move

                const detailStartInOriginal = searchStart + afterKeywordIndexInContext + remainingContext.search(/\S/) + detail.start; // Adjust start index
                const detailEndInOriginal = detailStartInOriginal + (detail.end - detail.start);

                let added = false;
                if (!this._isConsumed(detailStartInOriginal, detailEndInOriginal, consumedIndices)) {
                     // Check if the detail type matches the keyword intent (or if keyword is generic like 'with')
                     if (
                         (keyword === 'ability' && detailType === 'ability') ||
                         (keyword === 'item' && detailType === 'item') || // less common to say "item [itemname]"
                         ((keyword === 'holding') && detailType === 'item') ||
                         ((keyword === 'move' || keyword === 'running' || keyword === 'using') && detailType === 'move') ||
                         (keyword === 'with') // 'with' can be any of them
                     ) {
                         switch (detailType) {
                             case 'item':
                                 parsed.pokemon_with_items.push({ pokemon: originalCasePokemon, item: detailValue });
                                 added = true;
                                 break;
                             case 'ability':
                                 parsed.pokemon_with_abilities.push({ pokemon: originalCasePokemon, ability: detailValue });
                                 added = true;
                                 break;
                             case 'move':
                                 parsed.pokemon_with_moves.push({ pokemon: originalCasePokemon, move: detailValue });
                                 added = true; // Allow multiple moves after 'with' or 'running'
                                 break;
                         }

                         if (added) {
                             // Consume the keyword + the identified detail entity phrase
                             const consumeStart = searchStart + keywordMatch.index;
                             const consumeEnd = detailEndInOriginal; // Consume up to the end of the found detail
                             for (let i = consumeStart; i < consumeEnd; i++) {
                                 consumedIndices.add(i);
                             }
                             // If we added something, advance the search within the context
                             // Update lastIndexInContext to avoid re-matching the same keyword immediately
                             lastIndexInContext = afterKeywordIndexInContext + detail.end;
                             detailKeywordRegex.lastIndex = lastIndexInContext; // Move regex pointer
                         }
                    }
                }
            }

             // Prevent infinite loops if regex doesn't advance
             if (detailKeywordRegex.lastIndex === (keywordMatch.index)) {
                 detailKeywordRegex.lastIndex++; // Force advance if stuck
             }
        }
    },

     _isConsumed(start, end, consumedIndices) {
        // Check if *any* index within the range [start, end) is already consumed
        for (let i = start; i < end; i++) {
            if (consumedIndices.has(i)) {
                return true;
            }
        }
        return false;
    },

    _escapeRegex(str) {
        // Escape characters with special meaning in regex
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
};

// --- Team Matcher ---
const TeamMatcher = {

    // Returns { score: number, metCriteria: object }
    calculateMatchScore(parsedInstruction, team) {
        let score = 0;
        // Initialize metCriteria structure matching parsedInstruction for easy tracking
        const metCriteria = {
            pokemon: new Set(),
            pokemon_with_items: new Set(),
            pokemon_with_tera: new Set(),
            pokemon_with_abilities: new Set(),
            pokemon_with_moves: new Set(),
            items: new Set(),
            moves: new Set(),
            abilities: new Set(),
            tera_types: new Set(),
            types_with_roles: new Set(),
            types: new Set(),
            roles: new Set(),
            size_requests: new Set(),
            weight_requests: new Set(),
            // Negations are not tracked here as "met"
        };

        if (!parsedInstruction || !team || !team.pokemons) {
            return { score: 0, metCriteria };
        }

        const teamPokemonNames = team.pokemons.map(p => p?.name).filter(Boolean);
        const teamPokemonNamesLower = teamPokemonNames.map(name => name.toLowerCase());

        // Helper to add to metCriteria sets safely
        const addCriterionMet = (category, value) => {
            if (metCriteria[category]) {
                 // Use JSON stringify for complex objects to ensure uniqueness in Set
                 const key = typeof value === 'object' ? JSON.stringify(value) : value;
                 metCriteria[category].add(key);
            }
        };


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
                 case 'type': // Check if any pokemon has this type OR tera type (common intent)
                     if (team.pokemons.some(p =>
                            p?.types?.map(t => t.toLowerCase()).includes(negation.value) ||
                            p?.tera_type?.toLowerCase() === negation.value
                         )) violated = true;
                     break;
                 case 'unknown': // If parser couldn't classify, check name against pokemon/item/ability/move
                     const lowerNegValue = negation.value.toLowerCase();
                     if (teamPokemonNamesLower.includes(lowerNegValue) ||
                         team.pokemons.some(p => p?.item?.toLowerCase() === lowerNegValue) ||
                         team.pokemons.some(p => p?.ability?.toLowerCase() === lowerNegValue) ||
                         team.pokemons.some(p => p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === lowerNegValue)))
                     {
                        violated = true;
                     }
                     break;
                 // Add other negation types if needed
             }
             if (violated) {
                 /*console.log(`NEGATION VIOLATED: Team has excluded '${negation.value}' (Type: ${negation.type})`);*/
                 score += SCORE_WEIGHTS.NEGATIVE_CONSTRAINT_PENALTY;
                 // If a negation is violated, this team is not a match, return immediately.
                 // We don't need to report met positive criteria if a negative one fails.
                 return { score, metCriteria: this._convertMetCriteriaSets(metCriteria) }; // Return empty metCriteria
             }
         }


        // --- Positive Matches ---

        // 1. Exact Pokémon Presence
        parsedInstruction.pokemon.forEach(requestedPokemonName => {
            if (teamPokemonNames.includes(requestedPokemonName)) { // Match original case
                score += SCORE_WEIGHTS.EXACT_POKEMON;
                addCriterionMet('pokemon', requestedPokemonName);
            }
        });

        // 2. Pokémon with Specifics (Item, Tera, Ability, Move)
        parsedInstruction.pokemon_with_items.forEach(req => { // req = { pokemon, item }
            if (team.pokemons.some(p => p?.name === req.pokemon && p?.item?.toLowerCase() === req.item)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_ITEM;
                addCriterionMet('pokemon_with_items', req);
            }
        });
        parsedInstruction.pokemon_with_tera.forEach(req => { // req = { pokemon, tera_type }
            if (team.pokemons.some(p => p?.name === req.pokemon && p?.tera_type?.toLowerCase() === req.tera_type)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_TERA;
                 addCriterionMet('pokemon_with_tera', req);
            }
        });
        parsedInstruction.pokemon_with_abilities.forEach(req => { // req = { pokemon, ability }
            if (team.pokemons.some(p => p?.name === req.pokemon && p?.ability?.toLowerCase() === req.ability)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_ABILITY;
                 addCriterionMet('pokemon_with_abilities', req);
            }
        });
        parsedInstruction.pokemon_with_moves.forEach(req => { // req = { pokemon, move }
            if (team.pokemons.some(p => p?.name === req.pokemon && p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === req.move))) {
                score += SCORE_WEIGHTS.POKEMON_WITH_MOVE;
                 addCriterionMet('pokemon_with_moves', req);
            }
        });

        // 3. Size/Weight Requests
        parsedInstruction.size_requests.forEach(req => { // req = { type, count }
            const count = team.pokemons.filter(p => p?.height !== null && p?.height !== undefined &&
                ((req.type === 'small' && p.height <= SMALL_THRESHOLD_H) || (req.type === 'tall' && p.height >= TALL_THRESHOLD_H))
            ).length;
            if (count >= req.count) {
                score += SCORE_WEIGHTS.SIZE_REQUEST;
                addCriterionMet('size_requests', req);
            }
        });
        parsedInstruction.weight_requests.forEach(req => { // req = { type, count }
             const count = team.pokemons.filter(p => p?.weight !== null && p?.weight !== undefined &&
                 ((req.type === 'light' && p.weight <= LIGHT_THRESHOLD_HG) || (req.type === 'heavy' && p.weight >= HEAVY_THRESHOLD_HG))
             ).length;
            if (count >= req.count) {
                score += SCORE_WEIGHTS.WEIGHT_REQUEST;
                addCriterionMet('weight_requests', req);
            }
        });

        // 4. General Item/Move/Ability/Tera Presence
        parsedInstruction.items.forEach(item => {
            if (team.pokemons.some(p => p?.item?.toLowerCase() === item)) {
                score += SCORE_WEIGHTS.POKEMON_WITH_ITEM / 3; // Lower score for general presence
                addCriterionMet('items', item);
            }
        });
        parsedInstruction.moves.forEach(move => {
            if (team.pokemons.some(p => p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase() === move))) {
                score += SCORE_WEIGHTS.GENERAL_MOVE;
                addCriterionMet('moves', move);
            }
        });
        parsedInstruction.abilities.forEach(ability => {
            if (team.pokemons.some(p => p?.ability?.toLowerCase() === ability)) {
                score += SCORE_WEIGHTS.GENERAL_ABILITY;
                addCriterionMet('abilities', ability);
            }
        });
         parsedInstruction.tera_types.forEach(tera => {
             if (team.pokemons.some(p => p?.tera_type?.toLowerCase() === tera)) {
                 score += SCORE_WEIGHTS.POKEMON_WITH_TERA / 3; // Lower score for general presence
                 addCriterionMet('tera_types', tera);
             }
         });

        // 5. Type / Role / Archetype Matching
        const checkRole = (p, role) => {
             const stats = p?.stats;
             if (!stats) return false;
             role = role.toLowerCase(); // Ensure role is lowercase for checks
             // Use includes for flexibility (e.g., "strong attacker" includes "attacker")
             if ((role.includes("physical attacker") || role.includes("attacker")) && stats.attack >= 115) return true;
             if ((role.includes("special attack") || role.includes("special attacker")) && stats['special-attack'] >= 115) return true;
             if ((role.includes("physical defense") || role.includes("defensive") || role.includes("defense")) && stats.defense >= 105) return true;
             if ((role.includes("special defense") || role.includes("specially defensive")) && stats['special-defense'] >= 105) return true;
             if ((role.includes("speed") || role.includes("fast") || role.includes("speedy")) && stats.speed >= 105) return true;
             if ((role.includes("bulk") || role.includes("hp") || role.includes("health")) && stats.hp >= 100) return true;
             if (role.includes("wall") && (stats.defense >= 115 || stats['special-defense'] >= 115)) return true;
             // Add more specific role checks if needed
             return false;
        };

        parsedInstruction.roles.forEach(role => {
            if (team.pokemons.some(p => checkRole(p, role))) {
                score += SCORE_WEIGHTS.GENERAL_ROLE;
                addCriterionMet('roles', role);
            }
        });

        parsedInstruction.types.forEach(type => {
            if (team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(type))) {
                score += SCORE_WEIGHTS.GENERAL_TYPE;
                addCriterionMet('types', type);
            }
        });

        parsedInstruction.types_with_roles.forEach(tr => { // tr = { type, role }
             if (team.pokemons.some(p => p?.types?.map(t => t.toLowerCase()).includes(tr.type) && checkRole(p, tr.role))) {
                 score += SCORE_WEIGHTS.TYPE_ROLE_MATCH;
                 addCriterionMet('types_with_roles', tr);
             }
         });

        // TODO: Add Archetype scoring bonuses if ARCHETYPES are detected in parsedInstruction

        return { score: Math.max(0, score), metCriteria: this._convertMetCriteriaSets(metCriteria) };
    },

    _convertMetCriteriaSets(metCriteriaSets) {
        // Convert Sets back to arrays for easier processing later
        const finalMetCriteria = {};
        for (const key in metCriteriaSets) {
            finalMetCriteria[key] = [...metCriteriaSets[key]].map(item => {
                try { return JSON.parse(item); } // Try parsing back objects
                catch (e) { return item; } // Keep primitives as is
            });
        }
        return finalMetCriteria;
    }
};

// --- Generator ---
const Generator = {

    async findMatchingTeams(instruction) {
        // 1. Ensure data is ready
        await DataService.initialize();
        if (!DataService.isInitialized || !DataService.getTeams()) {
            console.error("Data service not ready, cannot generate teams.");
            return [[], true, [], "Data failed to load."]; // [teams, noDetect, unmetCriteria, errorMessage]
        }

        // 2. Parse the instruction
        let parsedInstruction;
        try {
            parsedInstruction = InstructionParser.parse(instruction);
            if (!parsedInstruction) throw new Error("Parsing failed.");
            console.log("Parsed Instruction:", JSON.stringify(parsedInstruction, null, 2));
        } catch (error) {
            console.error("Error parsing instruction:", error);
             return [[], true, [], "Could not understand the request."];
        }

        // 3. Score all available teams and track met criteria
        const teams = DataService.getTeams();
        const scoredTeams = [];
        const overallMetCriteria = this._createEmptyMetCriteriaStructure(); // To aggregate across all teams

        teams.forEach((team, index) => {
            try {
                const { score, metCriteria: teamMetCriteria } = TeamMatcher.calculateMatchScore(parsedInstruction, team);

                // Check if a negative constraint was violated (score <= penalty indicates this)
                // TeamMatcher now returns score 0 if penalty is applied, so check < 0 or a very low value
                 if (score <= SCORE_WEIGHTS.NEGATIVE_CONSTRAINT_PENALTY + 1) { // Allow for slight positive score before penalty
                    // console.log(`Team ${index} (${team?.filename}) excluded due to negation violation.`);
                     return; // Skip this team entirely
                 }

                // Only consider teams with positive scores for unmet criteria analysis and results
                if (score > 0) {
                    scoredTeams.push({ team, score, index });
                    // Aggregate met criteria from this positively scoring team
                    this._aggregateMetCriteria(overallMetCriteria, teamMetCriteria);
                }
            } catch (error) {
                console.error(`Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error);
                // Don't add to scoredTeams if error during scoring
            }
        });

        // 4. Sort scored teams
        scoredTeams.sort((a, b) => b.score - a.score); // Highest score first

        // 5. Determine "no detection" and select best teams
        const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
        // No detection if no teams passed the negation checks AND scored positively
        const noDetect = scoredTeams.length === 0;

        // Select teams: Take all teams with the highest score
        const bestTeamsRaw = noDetect ? [] : scoredTeams.filter(st => st.score === maxScore);

        // 6. Identify Unmet Criteria based on *all* positively scoring teams found
        const unmetCriteriaList = this._getUnmetCriteria(parsedInstruction, overallMetCriteria);

        // 7. Format the output
        const simplifiedTeams = bestTeamsRaw.map(st => this._simplifyTeamData(st.team));

        return [simplifiedTeams, noDetect, unmetCriteriaList, null];
    },

    _createEmptyMetCriteriaStructure() {
        // Creates an object with Sets to store unique met criteria across all teams
        return {
            pokemon: new Set(),
            pokemon_with_items: new Set(), // Will store stringified {pokemon, item}
            pokemon_with_tera: new Set(),    // Will store stringified {pokemon, tera_type}
            pokemon_with_abilities: new Set(),// Will store stringified {pokemon, ability}
            pokemon_with_moves: new Set(),   // Will store stringified {pokemon, move}
            items: new Set(),
            moves: new Set(),
            abilities: new Set(),
            tera_types: new Set(),
            types_with_roles: new Set(), // Will store stringified {type, role}
            types: new Set(),
            roles: new Set(),
            size_requests: new Set(),    // Will store stringified {type, count}
            weight_requests: new Set(), // Will store stringified {type, count}
            // negations are handled separately
        };
    },

    _aggregateMetCriteria(overallMet, teamMet) {
        // Merges criteria met by a single team into the overall tracker
        for (const category in teamMet) {
            if (overallMet[category] && Array.isArray(teamMet[category])) {
                teamMet[category].forEach(value => {
                    const key = typeof value === 'object' ? JSON.stringify(value) : value;
                    overallMet[category].add(key);
                });
            }
        }
    },

     _getUnmetCriteria(parsed, overallMetSets) {
        const unmet = [];

        // Helper to check a category
        const checkCategory = (category, requestedItems, stringifier) => {
            if (!requestedItems || requestedItems.length === 0) return; // Skip if nothing was requested in this category

            const metSet = overallMetSets[category]; // The Set of met items (or stringified objects)

            requestedItems.forEach(item => {
                const key = stringifier(item);
                if (!metSet?.has(key)) {
                    // Only add if *no* positively scoring team met this specific criterion
                    unmet.push(this._getCriterionString(category, item));
                }
            });
        };

        // Check each category from the parsed instruction
        checkCategory('pokemon', parsed.pokemon, p => p);
        checkCategory('pokemon_with_items', parsed.pokemon_with_items, JSON.stringify);
        checkCategory('pokemon_with_tera', parsed.pokemon_with_tera, JSON.stringify);
        checkCategory('pokemon_with_abilities', parsed.pokemon_with_abilities, JSON.stringify);
        checkCategory('pokemon_with_moves', parsed.pokemon_with_moves, JSON.stringify);
        checkCategory('items', parsed.items, i => i);
        checkCategory('moves', parsed.moves, m => m);
        checkCategory('abilities', parsed.abilities, a => a);
        checkCategory('tera_types', parsed.tera_types, t => t);
        checkCategory('types_with_roles', parsed.types_with_roles, JSON.stringify);
        checkCategory('types', parsed.types, t => t);
        checkCategory('roles', parsed.roles, r => r);
        checkCategory('size_requests', parsed.size_requests, JSON.stringify);
        checkCategory('weight_requests', parsed.weight_requests, JSON.stringify);

        // Return unique unmet criteria strings
        return [...new Set(unmet)];
    },

    _getCriterionString(category, value) {
        // Creates q string for an unmet criterion
        try {
            switch (category) {
                case 'pokemon': return `Pokémon: <code>${value}</code>`;
                case 'pokemon_with_items': return `Pokémon/Item: <code>${value.pokemon}</code> with <code>${value.item}</code>`;
                case 'pokemon_with_tera': return `Pokémon/Tera: <code>${value.pokemon}</code> Tera <code>${value.tera_type}</code>`;
                case 'pokemon_with_abilities': return `Pokémon/Ability: <code>${value.pokemon}</code> with <code>${value.ability}</code>`;
                case 'pokemon_with_moves': return `Pokémon/Move: <code>${value.pokemon}</code> with <code>${value.move}</code>`;
                case 'items': return `Item: <code>${value}</code>`;
                case 'moves': return `Move: <code>${value}</code>`;
                case 'abilities': return `Ability: <code>${value}</code>`;
                case 'tera_types': return `Tera Type: <code>${value}</code>`;
                case 'types_with_roles': return `Type/Role: <code>${value.role} ${value.type}</code>`;
                case 'types': return `Type: <code>${value}</code>`;
                case 'roles': return `Role: <code>${value}</code>`;
                case 'size_requests': return `Size: <code>${value.count} ${value.type} Pokémon</code>`;
                case 'weight_requests': return `Weight: <code>${value.count} ${value.type} Pokémon</code>`;
                default: return JSON.stringify(value); // Fallback
            }
        } catch (e) {
            console.error("Error generating criterion string for:", category, value, e);
            return "an unspecified criterion"; // Error fallback
        }
    },

    _simplifyTeamData(team) {
        // Ensure robustness against potentially missing data
        return {
            filename: team?.filename || "unknown_filename",
            pokemons: (team?.pokemons || []).map(p => {
                if (!p || !p.name) return null; // Skip invalid pokemon entries

                const moves = Array.isArray(p.moves) ? p.moves : [];

                // Clean up move data - ensure name and type exist
                const processedMoves = moves.slice(0, 4).map(m => {
                    let name = null;
                    let type = 'unknown';
                    if (typeof m === 'object' && m?.name) {
                        name = m.name;
                        type = m.type?.toLowerCase() || 'unknown';
                    } else if (typeof m === 'string' && m !== '-') {
                        name = m;
                    }
                    // Return null if no valid name was found or if it's just a placeholder
                    return (name && name !== '-') ? { name, type } : null;
                }).filter(Boolean); // Remove nulls

                // Ensure Tera Type is valid or null
                const teraType = p.tera_type && TERA_TYPES.includes(p.tera_type.toLowerCase()) ? p.tera_type : null;

                return {
                    name: p.name, // Keep original case
                    ability: p.ability || null,
                    item: p.item || null, // Already expected to be string or null
                    moves: processedMoves, // Use the cleaned-up moves array
                    tera_type: teraType,
                    sprite: p.sprites?.front_default || null, // Use default sprite
                    /*
                    height: p.height,
                    weight: p.weight,
                    types: p.types || [],
                    stats: p.stats || {},
                    */
                };
            }).filter(Boolean) // Filter out any null pokemon results
        };
    }
};

// --- Global Exposure ---
// Expose a single, clean function to the outside world.
window.generatePokepaste = async function(instruction) {
    return await Generator.findMatchingTeams(instruction);
};

// Initialize data service automatically on script load
DataService.initialize().catch(err => {
     console.error("Automatic DataService initialization failed on load:", err);
     // Maybe display a user-facing error?
});