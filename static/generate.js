// --- Constants ---
const DATA_URL = 'https://pikoow.github.io/VGCPastes-Finder/data/processed_data.json';
const SHOWDOWN_ITEMS_URL = "https://play.pokemonshowdown.com/data/items.js";
const SHOWDOWN_MOVES_URL = "https://play.pokemonshowdown.com/data/moves.js";
const SHOWDOWN_ABILITIES_URL = "https://play.pokemonshowdown.com/data/abilities.js";

// Updated Weights for the new query structure
const SCORE_WEIGHTS = {
    // Specific Pokemon Criteria
    POKEMON_FOUND: 150,          // Found the specific Pokémon asked for in a Pokémon criterion block
    POKEMON_WITH_ITEM: 75,       // Pokémon criteria: Pokémon + Item match
    POKEMON_WITH_ABILITY: 75,    // Pokémon criteria: Pokémon + Ability match
    POKEMON_WITH_TERA: 75,       // Pokémon criteria: Pokémon + Tera match
    POKEMON_WITH_MOVE: 40,       // Pokémon criteria: Pokémon + one specified Move match (per move)

    // General Criteria
    GENERAL_ITEM: 35,            // Found an item requested generally
    GENERAL_ABILITY: 40,         // Found an ability requested generally
    GENERAL_MOVE: 25,            // Found a move requested generally
    GENERAL_TERA: 40,            // Found a Tera type requested generally
    GENERAL_ROLE: 45,            // Found a Pokémon matching a generally requested role
};

const TERA_TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy", "stellar"];
const ROLES = ["attacker", "physical attacker", "special attacker", "defensive", "physical defense", "special defense", "specially defensive", "fast", "speedy", "speed", "hp", "health", "bulky", "wall"];

// --- Data Service ---
const DataService = {
    rawData: null,
    // pokemonIndex stores global data AND pokemon-specific usage counts
    // Map<lowerCaseName, { originalCase, details, knownAbilities<Set>, knownMoves<Set>, count,
    //                      itemsUsed: Map<itemKey, {count, originalCase}>,
    //                      abilitiesUsed: Map<abilityKey, {count, originalCase}>,
    //                      terasUsed: Map<teraKey, {count, originalCase}>,
    //                      movesUsed: Map<moveKey, {count, originalCase}>
    //                    }>
    pokemonIndex: new Map(),
    // Global counts are still useful for general criteria and initial population
    itemCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }>
    moveCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }>
    abilityCounts: new Map(),// Map<lowerCaseName, { count, originalCase }>
    teraCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }>
    // Global sets for validation
    allItems: new Set(),
    allMoves: new Set(),
    allAbilities: new Set(),
    isInitialized: false,
    dataLoadedPromise: null,

    async initialize() {
        if (this.isInitialized) return;
        if (this.dataLoadedPromise) return this.dataLoadedPromise;

        this.dataLoadedPromise = this._loadAllData();

        try {
            await this.dataLoadedPromise;
            this.isInitialized = true;
            /*
            console.log("DataService: Initialization complete.");
            console.log(`DataService: Loaded ${this.pokemonIndex.size} unique Pokémon.`);
            console.log(`DataService: Counted globally ${this.itemCounts.size} items, ${this.moveCounts.size} moves, ${this.abilityCounts.size} abilities, ${this.teraCounts.size} tera types.`);
            */
        } catch (error) {
            console.error("DataService: Initialization failed!", error);
            this.isInitialized = false;
            // Reset all data structures on failure
            this.rawData = null;
            this.pokemonIndex.clear();
            this.itemCounts.clear();
            this.moveCounts.clear();
            this.abilityCounts.clear();
            this.teraCounts.clear();
            this.allItems.clear();
            this.allMoves.clear();
            this.allAbilities.clear();
            throw error;
        } finally {
            this.dataLoadedPromise = null;
        }
    },

    async _loadAllData() {
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`Failed to fetch processed data: ${response.status} ${response.statusText}`);
            this.rawData = await response.json();
            if (!this.rawData || !Array.isArray(this.rawData)) {
                 throw new Error("Processed data format is invalid or empty.");
            }
            /* console.log(`DataService: Fetched ${this.rawData.length} teams.`); */
            this._preprocessRawData(); // Count occurrences here
        } catch (error) {
            console.error('DataService: Error loading or preprocessing team data:', error);
            throw error;
        }

        // Fetching Showdown data remains useful for the global 'all*' Sets for validation
        const results = await Promise.allSettled([
            this._fetchShowdownData(SHOWDOWN_ITEMS_URL, 'BattleItems', this.allItems),
            this._fetchShowdownData(SHOWDOWN_MOVES_URL, 'BattleMovedex', this.allMoves),
            this._fetchShowdownData(SHOWDOWN_ABILITIES_URL, 'BattleAbilities', this.allAbilities)
        ]);

        // Normalize global sets
        this.allItems = new Set([...this.allItems].map(i => i?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allMoves = new Set([...this.allMoves].map(m => m?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allAbilities = new Set([...this.allAbilities].map(a => a?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));

        // --- Urshifu Handling (Synthesize if needed, ensure count structures) ---
        const handleUrshifu = (baseKey, formKey, formName) => {
            if (this.pokemonIndex.has(baseKey) && !this.pokemonIndex.has(formKey)) {
                 const baseData = this.pokemonIndex.get(baseKey);
                 const formData = JSON.parse(JSON.stringify(baseData)); // Deep copy might be overkill if structure is simple
                 formData.originalCase = formName;
                 formData.details = formData.details || {};
                 formData.details.name = formName;
                 // Ensure count structures exist (will be populated during preprocess)
                 formData.itemsUsed = formData.itemsUsed || new Map();
                 formData.abilitiesUsed = formData.abilitiesUsed || new Map();
                 formData.terasUsed = formData.terasUsed || new Map();
                 formData.movesUsed = formData.movesUsed || new Map();
                 formData.knownAbilities = new Set(baseData.knownAbilities);
                 formData.knownMoves = new Set(baseData.knownMoves);
                 formData.count = 0; // Form count starts at 0 unless explicitly counted
                 this.pokemonIndex.set(formKey, formData);
            }
        };
        const handleBaseUrshifu = () => {
            const rapidStrikeKey = 'urshifu-rapid-strike';
            const singleStrikeKey = 'urshifu-single-strike';
            if (!this.pokemonIndex.has('urshifu') && (this.pokemonIndex.has(rapidStrikeKey) || this.pokemonIndex.has(singleStrikeKey))) {
                const formKey = this.pokemonIndex.has(rapidStrikeKey) ? rapidStrikeKey : singleStrikeKey;
                const form = this.pokemonIndex.get(formKey);
                const baseData = JSON.parse(JSON.stringify(form)); // Deep copy might be overkill
                baseData.originalCase = "Urshifu";
                baseData.details = baseData.details || {};
                baseData.details.name = "Urshifu";
                // Initialize count structures
                baseData.itemsUsed = baseData.itemsUsed || new Map();
                baseData.abilitiesUsed = baseData.abilitiesUsed || new Map();
                baseData.terasUsed = baseData.terasUsed || new Map();
                baseData.movesUsed = baseData.movesUsed || new Map();
                baseData.knownAbilities = new Set(form.knownAbilities || []);
                baseData.knownMoves = new Set(form.knownMoves || []);
                baseData.count = 0; // Base count starts at 0 unless explicitly counted
                this.pokemonIndex.set('urshifu', baseData);
            }
        };

        handleUrshifu('urshifu', 'urshifu-rapid-strike', 'Urshifu-Rapid-Strike');
        handleUrshifu('urshifu', 'urshifu-single-strike', 'Urshifu-Single-Strike');
        handleBaseUrshifu();
        // Reprocess might be needed if synthesis happens after initial pass,
        // but _preprocessRawData runs after fetch, so it should handle counts correctly
        // based on the existing pokemonIndex keys after synthesis.
    },

    // Helper to increment count in a map { count, originalCase }
    _incrementCount(map, key, originalCaseValue) {
        if (!key || !map) return;
        const lowerKey = key.toLowerCase().trim().replace(/ /g, '-');
        if (!lowerKey) return;

        if (map.has(lowerKey)) {
            map.get(lowerKey).count++;
            // Optionally update originalCase if a more common one appears? For now, first seen wins.
            if (!map.get(lowerKey).originalCase) {
                map.get(lowerKey).originalCase = originalCaseValue;
            }
        } else {
            map.set(lowerKey, { count: 1, originalCase: originalCaseValue });
        }
    },

    _preprocessRawData() {
        if (!this.rawData) return;
        // Clear global counts before reprocessing
        this.itemCounts.clear();
        this.moveCounts.clear();
        this.abilityCounts.clear();
        this.teraCounts.clear();
        // Reset existing Pokémon counts and nested counts before reprocessing
        this.pokemonIndex.forEach(entry => {
             entry.count = 0;
             entry.itemsUsed = new Map();
             entry.abilitiesUsed = new Map();
             entry.terasUsed = new Map();
             entry.movesUsed = new Map();
             entry.knownAbilities = new Set(); // Also reset known sets
             entry.knownMoves = new Set();
        });


        this.rawData.forEach(team => {
            team.pokemons?.forEach(p => {
                if (!p?.name) return;

                const lowerName = p.name.toLowerCase().replace(/ /g, '-');
                const itemLower = p.item?.toLowerCase().trim().replace(/ /g, '-');
                const abilityLower = p.ability?.toLowerCase().trim().replace(/ /g, '-');
                const teraLower = p.tera_type?.toLowerCase().trim();

                // --- Get or Create Pokémon Entry ---
                if (!this.pokemonIndex.has(lowerName)) {
                    this.pokemonIndex.set(lowerName, {
                        originalCase: p.name,
                        details: p, // Store details (like stats) if needed later
                        knownAbilities: new Set(),
                        knownMoves: new Set(),
                        count: 0, // Initialize global count
                        itemsUsed: new Map(),
                        abilitiesUsed: new Map(),
                        terasUsed: new Map(),
                        movesUsed: new Map()
                    });
                }
                const pokemonEntry = this.pokemonIndex.get(lowerName);

                // --- Pokémon Global Count ---
                pokemonEntry.count++;

                // --- Ability Counting (Global and Pokémon-Specific) ---
                if (p.ability && abilityLower) {
                     pokemonEntry.knownAbilities.add(abilityLower);
                     this._incrementCount(this.abilityCounts, abilityLower, p.ability); // Global
                     this._incrementCount(pokemonEntry.abilitiesUsed, abilityLower, p.ability); // Pokemon-specific
                     this.allAbilities.add(p.ability); // Add original case to validation set
                }

                // --- Item Counting (Global and Pokémon-Specific) ---
                if (p.item && p.item !== "None" && itemLower) {
                     this._incrementCount(this.itemCounts, itemLower, p.item); // Global
                     this._incrementCount(pokemonEntry.itemsUsed, itemLower, p.item); // Pokemon-specific
                     this.allItems.add(p.item); // Add original case to validation set
                }

                // --- Tera Counting (Global and Pokémon-Specific) ---
                if (teraLower && TERA_TYPES.includes(teraLower)) {
                    this._incrementCount(this.teraCounts, teraLower, p.tera_type); // Global
                    this._incrementCount(pokemonEntry.terasUsed, teraLower, p.tera_type); // Pokemon-specific
                }

                // --- Move Counting (Global and Pokémon-Specific) ---
                if (p.moves) {
                    p.moves.forEach(move => {
                        const moveName = (typeof move === 'object' ? move.name : move);
                        const moveNameLower = moveName?.toLowerCase().trim().replace(/ /g, '-');
                        if (moveName && moveName !== '-' && moveNameLower) {
                             pokemonEntry.knownMoves.add(moveNameLower);
                             this._incrementCount(this.moveCounts, moveNameLower, moveName); // Global
                             this._incrementCount(pokemonEntry.movesUsed, moveNameLower, moveName); // Pokemon-specific
                             this.allMoves.add(moveName); // Add original case to validation set
                        }
                    });
                }
            });
        });
    },

    // --- Fetch Showdown Data (remains the same) ---
    async _fetchShowdownData(url, exportName, targetSet) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const text = await response.text();
            const dataRegex = new RegExp(`(?:exports|this)\\.${exportName}\\s*=\\s*({[\\s\\S]*?});`);
            const match = text.match(dataRegex);

            if (match && match[1]) {
                const dataBlock = match[1];
                let parsedData = {};
                try {
                    const parseFunc = new Function(`return ${dataBlock};`);
                    parsedData = parseFunc();
                } catch (e) {
                    console.error(`DataService: Failed to parse JSON-like structure for ${exportName} from ${url}. Error: ${e}`);
                    const nameRegex = /name:\s*"([^"]+)"/g;
                    let nameMatch;
                    while ((nameMatch = nameRegex.exec(dataBlock)) !== null) {
                        if (nameMatch[1]) targetSet.add(nameMatch[1]);
                    }
                    return;
                }
                for (const key in parsedData) {
                    if (parsedData[key] && parsedData[key].name) {
                        targetSet.add(parsedData[key].name);
                    }
                }
            } else {
                console.warn(`DataService: Could not find or parse ${exportName} data block in ${url}. Regex might need adjustment.`);
            }
        } catch (error) {
            console.error(`DataService: Error fetching/parsing ${url}:`, error);
        }
    },

    // --- Public Methods ---
    getTeams: () => DataService.rawData,
    getPokemonDetails: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.details,
    isValidPokemon: (name) => DataService.pokemonIndex.has(name?.toLowerCase()),
    isValidItem: (name) => DataService.allItems.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidMove: (name) => DataService.allMoves.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidAbility: (name) => DataService.allAbilities.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidTeraType: (name) => TERA_TYPES.includes(name?.toLowerCase()),
    isValidRole: (name) => ROLES.includes(name?.toLowerCase()),

    // --- Methods for Populating Selects with Counts ---

    /**
     * Generic helper to get sorted data from a count map.
     * @param {Map<string, {count: number, originalCase: string}>} countMap
     * @returns {Array<{key: string, display: string, count: number}>} Sorted array
     */
    _getSortedDataFromMap(countMap) {
        if (!countMap || countMap.size === 0) return [];
        return Array.from(countMap.entries())
            .map(([key, { count, originalCase }]) => ({
                key: key, // lowercase key for option value
                display: `${originalCase} (${count})`, // Formatted display text
                count: count
            }))
            .sort((a, b) => b.count - a.count); // Sort descending by count
    },

    /** Gets sorted GLOBAL Pokémon data. */
    getPokemonSortedByCount() {
        return Array.from(this.pokemonIndex.entries())
             .map(([key, { count, originalCase }]) => ({
                 key: key,
                 display: `${originalCase} (${count})`,
                 count: count
             }))
             .sort((a, b) => b.count - a.count);
    },

    // GLOBAL Counts
    getItemsSortedByCount: () => DataService._getSortedDataFromMap(DataService.itemCounts),
    getMovesSortedByCount: () => DataService._getSortedDataFromMap(DataService.moveCounts),
    getAbilitiesSortedByCount: () => DataService._getSortedDataFromMap(DataService.abilityCounts),
    getTerasSortedByCount: () => DataService._getSortedDataFromMap(DataService.teraCounts), // Use counted teras globally
    getAllRolesLower: () => [...ROLES].sort(), // Keep alphabetical for static lists

    // --- POKEMON-SPECIFIC Counts (NEW) ---
    getItemsForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        return this._getSortedDataFromMap(pokemonData?.itemsUsed);
    },
    getAbilitiesForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        return this._getSortedDataFromMap(pokemonData?.abilitiesUsed);
    },
    getMovesForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        return this._getSortedDataFromMap(pokemonData?.movesUsed);
    },
    getTerasForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        return this._getSortedDataFromMap(pokemonData?.terasUsed);
    },
};

// --- Team Matcher (No changes needed) ---
const TeamMatcher = {
    calculateMatchScore(queryCriteria, team) {
        let score = 0;
        const teamPokemons = team?.pokemons || [];
        if (!queryCriteria || !Array.isArray(queryCriteria) || teamPokemons.length === 0) {
            return { score: 0 };
        }
        let criteriaMatches = 0;

        queryCriteria.forEach(criterion => {
            let criterionSatisfied = false;
            let bestMatchScoreForCriterion = 0; // For Pokémon criteria scoring

            switch (criterion.type) {
                case 'pokemon':
                    teamPokemons.forEach(p => {
                        bestMatchScoreForCriterion = Math.max(bestMatchScoreForCriterion, this._calculateSinglePokemonMatchScore(p, criterion));
                    });
                    score += bestMatchScoreForCriterion;
                    if (bestMatchScoreForCriterion > 0) criteriaMatches++;
                    break;

                case 'item':
                    criterionSatisfied = teamPokemons.some(p => p?.item?.toLowerCase().replace(/ /g, '-') === criterion.value);
                    if (criterionSatisfied) {
                        score += SCORE_WEIGHTS.GENERAL_ITEM;
                        criteriaMatches++;
                    }
                    break;

                case 'ability':
                    criterionSatisfied = teamPokemons.some(p => p?.ability?.toLowerCase().replace(/ /g, '-') === criterion.value);
                    if (criterionSatisfied) {
                        score += SCORE_WEIGHTS.GENERAL_ABILITY;
                        criteriaMatches++;
                    }
                    break;

                case 'move':
                    criterionSatisfied = teamPokemons.some(p =>
                        p?.moves?.some(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-') === criterion.value)
                    );
                    if (criterionSatisfied) {
                        score += SCORE_WEIGHTS.GENERAL_MOVE;
                        criteriaMatches++;
                    }
                    break;

                case 'tera':
                     criterionSatisfied = teamPokemons.some(p => p?.tera_type?.toLowerCase() === criterion.value);
                     if (criterionSatisfied) {
                         score += SCORE_WEIGHTS.GENERAL_TERA;
                         criteriaMatches++;
                     }
                     break;

                case 'role':
                    criterionSatisfied = teamPokemons.some(p => this._checkPokemonRole(p, criterion.value));
                    if (criterionSatisfied) {
                        score += SCORE_WEIGHTS.GENERAL_ROLE;
                        criteriaMatches++;
                    }
                    break;
            }
        });
        return { score: Math.max(0, score) };
    },

    _checkSinglePokemonMatch(pokemon, pokemonCriterion) {
        if (!pokemon || !pokemonCriterion || pokemon.name?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.pokemonName?.toLowerCase()) return false;
        if (!pokemonCriterion.pokemonName) return false;
        if (pokemonCriterion.item && pokemon.item?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.item) return false;
        if (pokemonCriterion.ability && pokemon.ability?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.ability) return false;
        if (pokemonCriterion.tera && pokemon.tera_type?.toLowerCase() !== pokemonCriterion.tera) return false;

        const requiredMoves = [pokemonCriterion.move1, pokemonCriterion.move2, pokemonCriterion.move3, pokemonCriterion.move4].filter(Boolean);
        if (requiredMoves.length > 0) {
            const pokemonMovesLower = pokemon.moves?.map(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-')).filter(Boolean) || [];
            if (!requiredMoves.every(reqMove => pokemonMovesLower.includes(reqMove))) return false;
        }
        return true;
    },

     _calculateSinglePokemonMatchScore(pokemon, pokemonCriterion) {
         let singlePokemonScore = 0;
         if (!pokemon || !pokemonCriterion || !pokemonCriterion.pokemonName) return 0;
         const pokemonNameLower = pokemon.name?.toLowerCase().replace(/ /g, '-');
         const criterionNameLower = pokemonCriterion.pokemonName?.toLowerCase();

         if (pokemonNameLower !== criterionNameLower) return 0;
         singlePokemonScore += SCORE_WEIGHTS.POKEMON_FOUND;

         if (pokemonCriterion.item && pokemon.item?.toLowerCase().replace(/ /g, '-') === pokemonCriterion.item) singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_ITEM;
         if (pokemonCriterion.ability && pokemon.ability?.toLowerCase().replace(/ /g, '-') === pokemonCriterion.ability) singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_ABILITY;
         if (pokemonCriterion.tera && pokemon.tera_type?.toLowerCase() === pokemonCriterion.tera) singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_TERA;

         const requiredMoves = [pokemonCriterion.move1, pokemonCriterion.move2, pokemonCriterion.move3, pokemonCriterion.move4].filter(Boolean);
         if (requiredMoves.length > 0) {
             const pokemonMovesLower = new Set(pokemon.moves?.map(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-')).filter(Boolean) || []);
             requiredMoves.forEach(reqMove => {
                 if (pokemonMovesLower.has(reqMove)) singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_MOVE;
             });
         }
         return singlePokemonScore;
     },

     _checkPokemonRole(pokemon, role) {
         const stats = pokemon?.stats;
         if (!stats) return false;
         role = role?.toLowerCase();
         if (!role) return false;
         const ATK_THRESHOLD = 110, SPA_THRESHOLD = 110, DEF_THRESHOLD = 100, SPD_THRESHOLD = 100, SPE_THRESHOLD = 100, HP_THRESHOLD = 95;

         if ((role.includes("physical attacker") || role === "attacker") && stats.attack >= ATK_THRESHOLD) return true;
         if ((role.includes("special attack") || role === "special attacker") && stats['special-attack'] >= SPA_THRESHOLD) return true;
         if (role === "attacker" && (stats.attack >= ATK_THRESHOLD || stats['special-attack'] >= SPA_THRESHOLD)) return true;

         if ((role.includes("physical defense") || role === "defensive" || role === "defense") && stats.defense >= DEF_THRESHOLD) return true;
         if ((role.includes("special defense") || role === "specially defensive") && stats['special-defense'] >= SPD_THRESHOLD) return true;
         if ((role === "defensive" || role === "defense") && (stats.defense >= DEF_THRESHOLD || stats['special-defense'] >= SPD_THRESHOLD)) return true;

         if ((role.includes("speed") || role.includes("fast") || role.includes("speedy")) && stats.speed >= SPE_THRESHOLD) return true;
         if ((role.includes("bulk") || role.includes("hp") || role.includes("health")) && stats.hp >= HP_THRESHOLD) return true;
         if (role.includes("wall") && (stats.defense >= DEF_THRESHOLD + 15 || stats['special-defense'] >= SPD_THRESHOLD + 15)) return true;
         if (role === "bulky" && stats.hp >= HP_THRESHOLD && (stats.defense >= DEF_THRESHOLD || stats['special-defense'] >= SPD_THRESHOLD)) return true;

         return false;
    },
};


// --- Generator (No changes needed) ---
const Generator = {
    async findMatchingTeams(queryCriteria) {
        try { await DataService.initialize(); }
        catch (error) { console.error("Generator: DataService initialization failed.", error); return []; }
        if (!DataService.isInitialized || !DataService.getTeams()) { console.error("Generator: Data service not ready."); return []; }
        if (!queryCriteria || queryCriteria.length === 0) { console.warn("Generator: Query criteria empty."); return []; }

        const allTeams = DataService.getTeams();
        const scoredTeams = [];
        allTeams.forEach((team, index) => {
            if (!team || !Array.isArray(team.pokemons)) return;
            try {
                const { score } = TeamMatcher.calculateMatchScore(queryCriteria, team);
                if (score > 0) {
                    scoredTeams.push({ team, score, index });
                }
            } catch (error) {
                console.error(`Generator: Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error);
            }
        });

        scoredTeams.sort((a, b) => b.score - a.score);
        const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
        const bestTeamsRaw = maxScore > 0 ? scoredTeams.filter(st => st.score === maxScore) : [];

        return bestTeamsRaw.map(st => this._simplifyTeamData(st.team));
    },

    _simplifyTeamData(team) {
        return {
            filename: team?.filename || "unknown_filename.txt",
            pokemons: (team?.pokemons || []).map(p => {
                if (!p?.name) return null;
                const moves = Array.isArray(p.moves) ? p.moves : [];
                const processedMoves = moves.slice(0, 4).map(m => {
                    let name = null;
                    let type = 'unknown';
                    if (typeof m === 'object' && m?.name && m.name !== '-') {
                        name = m.name;
                        type = m.type?.toLowerCase() || 'unknown';
                    } else if (typeof m === 'string' && m !== '-') {
                        name = m;
                    }
                    return name ? { name, type } : null;
                }).filter(Boolean);

                const teraTypeLower = p.tera_type?.toLowerCase();
                const validTeraType = teraTypeLower && TERA_TYPES.includes(teraTypeLower) ? p.tera_type : null;
                const sprite = p.sprites?.front_default || null;

                return {
                    name: p.name,
                    ability: p.ability || null,
                    item: (p.item && p.item !== "None") ? p.item : null,
                    moves: processedMoves,
                    tera_type: validTeraType,
                    sprite: sprite,
                };
            }).filter(Boolean)
        };
    }
};

// --- Global Exposure ---
window.generatePokepaste = async function(queryCriteria) {
    return await Generator.findMatchingTeams(queryCriteria);
};

// --- Auto-Initialize DataService ---
DataService.initialize().then(() => {
    document.dispatchEvent(new CustomEvent('dataReady'));
}).catch(err => {
    console.error("generate.js: Automatic DataService initialization failed on load:", err);
});