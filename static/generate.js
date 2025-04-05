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
    pokemonIndex: new Map(), // Map<lowerCaseName, { originalCase, details, knownAbilities<Set>, knownMoves<Set>, count }>
    itemCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }>
    moveCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }>
    abilityCounts: new Map(),// Map<lowerCaseName, { count, originalCase }>
    teraCounts: new Map(),   // Map<lowerCaseName, { count, originalCase }> - Can add if needed, but list is static
    // Retain sets for potential quick validation if needed later
    allItems: new Set(),
    allMoves: new Set(),
    allAbilities: new Set(),
    isInitialized: false,
    dataLoadedPromise: null,

    async initialize() {
        if (this.isInitialized) return;
        if (this.dataLoadedPromise) return this.dataLoadedPromise;

        console.log("DataService: Starting data initialization...");
        this.dataLoadedPromise = this._loadAllData();

        try {
            await this.dataLoadedPromise;
            this.isInitialized = true;
            console.log("DataService: Initialization complete.");
            console.log(`DataService: Loaded ${this.pokemonIndex.size} unique Pokémon.`);
            console.log(`DataService: Counted ${this.itemCounts.size} items, ${this.moveCounts.size} moves, ${this.abilityCounts.size} abilities.`);
        } catch (error) {
            console.error("DataService: Initialization failed!", error);
            this.isInitialized = false;
            // Reset all data structures on failure
            this.rawData = null;
            this.pokemonIndex.clear();
            this.itemCounts.clear();
            this.moveCounts.clear();
            this.abilityCounts.clear();
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
            console.log(`DataService: Fetched ${this.rawData.length} teams.`);
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
        // ... (rest of Showdown fetching and normalization remains the same) ...
        this.allItems = new Set([...this.allItems].map(i => i?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allMoves = new Set([...this.allMoves].map(m => m?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allAbilities = new Set([...this.allAbilities].map(a => a?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));

        // Urshifu handling - ensure counts are handled if forms are synthesized
         if (this.pokemonIndex.has('urshifu')) {
            const urshifuData = this.pokemonIndex.get('urshifu');
             const rapidStrikeKey = 'urshifu-rapid-strike';
             const singleStrikeKey = 'urshifu-single-strike';
             const baseCount = urshifuData.count || 0; // Get base count

            if (!this.pokemonIndex.has(rapidStrikeKey)) {
                 const rapidStrikeData = JSON.parse(JSON.stringify(urshifuData)); // Deep copy
                 rapidStrikeData.originalCase = "Urshifu-Rapid-Strike";
                 rapidStrikeData.details = rapidStrikeData.details || {};
                 rapidStrikeData.details.name = "Urshifu-Rapid-Strike";
                 rapidStrikeData.knownAbilities = new Set(urshifuData.knownAbilities);
                 rapidStrikeData.knownMoves = new Set(urshifuData.knownMoves);
                 rapidStrikeData.count = 0; // Initialize form count, base count remains on base
                 this.pokemonIndex.set(rapidStrikeKey, rapidStrikeData);
                 console.log(`DataService: Synthesized ${rapidStrikeKey} from base Urshifu.`);
            }
             if (!this.pokemonIndex.has(singleStrikeKey)) {
                const singleStrikeData = JSON.parse(JSON.stringify(urshifuData)); // Deep copy
                singleStrikeData.originalCase = "Urshifu-Single-Strike";
                singleStrikeData.details = singleStrikeData.details || {};
                singleStrikeData.details.name = "Urshifu-Single-Strike";
                 singleStrikeData.knownAbilities = new Set(urshifuData.knownAbilities);
                 singleStrikeData.knownMoves = new Set(urshifuData.knownMoves);
                 singleStrikeData.count = 0; // Initialize form count
                this.pokemonIndex.set(singleStrikeKey, singleStrikeData);
                console.log(`DataService: Synthesized ${singleStrikeKey} from base Urshifu.`);
            }
             // Distribute base count if forms exist but base was counted? (complex - simpler to just count forms explicitly)
             // For now, counts will reflect exactly what's in the data. If "Urshifu" is listed, it gets counted. If "Urshifu-Rapid-Strike" is listed, it gets counted.
        }
        // ... (Synthesize base Urshifu if only forms exist - ensure count is initialized) ...
        if (!this.pokemonIndex.has('urshifu') && (this.pokemonIndex.has('urshifu-rapid-strike') || this.pokemonIndex.has('urshifu-single-strike'))) {
            const formKey = this.pokemonIndex.has('urshifu-rapid-strike') ? 'urshifu-rapid-strike' : 'urshifu-single-strike';
            const form = this.pokemonIndex.get(formKey);
            const baseData = JSON.parse(JSON.stringify(form)); // Deep copy
            baseData.originalCase = "Urshifu";
            baseData.details = baseData.details || {};
            baseData.details.name = "Urshifu";
            baseData.knownAbilities = new Set(form.knownAbilities || []);
            baseData.knownMoves = new Set(form.knownMoves || []);
            baseData.count = 0; // Initialize base count
            this.pokemonIndex.set('urshifu', baseData);
            console.log(`DataService: Synthesized base Urshifu from form ${formKey}.`);
        }
    },

    _incrementCount(map, key, originalCaseValue) {
        if (!key) return;
        if (map.has(key)) {
            map.get(key).count++;
        } else {
            map.set(key, { count: 1, originalCase: originalCaseValue });
        }
    },

    _preprocessRawData() {
        if (!this.rawData) return;
        this.itemCounts.clear();
        this.moveCounts.clear();
        this.abilityCounts.clear();
        this.pokemonIndex.clear(); // Clear before reprocessing

        this.rawData.forEach(team => {
            team.pokemons?.forEach(p => {
                if (!p?.name) return;

                const lowerName = p.name.toLowerCase().replace(/ /g, '-');
                const itemLower = p.item?.toLowerCase().trim().replace(/ /g, '-');
                const abilityLower = p.ability?.toLowerCase().trim().replace(/ /g, '-');

                // --- Pokémon Counting ---
                if (!this.pokemonIndex.has(lowerName)) {
                    this.pokemonIndex.set(lowerName, {
                        originalCase: p.name,
                        details: p,
                        knownAbilities: new Set(),
                        knownMoves: new Set(),
                        count: 0 // Initialize count
                    });
                }
                const pokemonEntry = this.pokemonIndex.get(lowerName);
                pokemonEntry.count++; // Increment Pokémon count

                // --- Ability Counting ---
                if (p.ability && abilityLower) {
                     pokemonEntry.knownAbilities.add(abilityLower);
                     this._incrementCount(this.abilityCounts, abilityLower, p.ability);
                     this.allAbilities.add(p.ability); // Still useful for the global validation Set
                }

                // --- Item Counting ---
                if (p.item && p.item !== "None" && itemLower) {
                     this._incrementCount(this.itemCounts, itemLower, p.item);
                     this.allItems.add(p.item); // Still useful for global validation Set
                }

                // --- Move Counting ---
                if (p.moves) {
                    p.moves.forEach(move => {
                        const moveName = (typeof move === 'object' ? move.name : move);
                        const moveNameLower = moveName?.toLowerCase().trim().replace(/ /g, '-');
                        if (moveName && moveName !== '-' && moveNameLower) {
                             pokemonEntry.knownMoves.add(moveNameLower);
                             this._incrementCount(this.moveCounts, moveNameLower, moveName);
                             this.allMoves.add(moveName); // Still useful for global validation Set
                        }
                    });
                }

                // --- Tera Counting (Optional, but consistent) ---
                if (p.tera_type && TERA_TYPES.includes(p.tera_type.toLowerCase())) {
                    const teraLower = p.tera_type.toLowerCase();
                    this._incrementCount(this.teraCounts, teraLower, p.tera_type);
                }
            });
        });

        console.log(`DataService: Preprocessing complete. Counted ${this.pokemonIndex.size} unique Pokémon entries.`);
    },

    // ... _fetchShowdownData remains the same ...
    async _fetchShowdownData(url, exportName, targetSet) {
        // --- Fetching logic remains the same ---
        // This populates the global `allItems`, `allMoves`, `allAbilities`
        // which are now less critical for UI population but potentially useful for validation.
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
                    // Try parsing as JSON5/relaxed JSON (more robust potentially)
                    // Simple Function constructor for now as it worked before
                    const parseFunc = new Function(`return ${dataBlock};`);
                    parsedData = parseFunc();
                } catch (e) {
                     console.error(`DataService: Failed to parse JSON-like structure for ${exportName} from ${url}. Error: ${e}`);
                     // Fallback regex extraction
                     const nameRegex = /name:\s*"([^"]+)"/g;
                     let nameMatch;
                     while ((nameMatch = nameRegex.exec(dataBlock)) !== null) {
                         if (nameMatch[1]) targetSet.add(nameMatch[1]); // Add original case name
                     }
                     console.log(`DataService: Extracted names via REGEX fallback for ${exportName}.`);
                     return; // Exit after fallback
                }

                // Add names from parsed data
                for (const key in parsedData) {
                    if (parsedData[key] && parsedData[key].name) {
                        targetSet.add(parsedData[key].name); // Add original case name
                    }
                }
                // console.log(`DataService: Successfully parsed/extracted names for ${exportName} from ${url}`); // Less verbose log

            } else {
                console.warn(`DataService: Could not find or parse ${exportName} data block in ${url}. Regex might need adjustment.`);
            }
        } catch (error) {
            console.error(`DataService: Error fetching/parsing ${url}:`, error);
            // Don't stop initialization if Showdown fetch fails
        }
    },

    // --- Public Methods ---
    getTeams: () => DataService.rawData,
    getPokemonDetails: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.details,
    // getOriginalCaseName: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.originalCase || name, // Use map data now
    isValidPokemon: (name) => DataService.pokemonIndex.has(name?.toLowerCase()),
    isValidItem: (name) => DataService.allItems.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidMove: (name) => DataService.allMoves.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidAbility: (name) => DataService.allAbilities.has(name?.toLowerCase().replace(/ /g, '-')),
    isValidTeraType: (name) => TERA_TYPES.includes(name?.toLowerCase()),
    isValidRole: (name) => ROLES.includes(name?.toLowerCase()),

    // --- NEW Methods for Populating Selects with Counts ---

    /**
     * Generic helper to get sorted data from a count map.
     * @param {Map<string, {count: number, originalCase: string}>} countMap
     * @returns {Array<{key: string, display: string, count: number}>} Sorted array
     */
    _getSortedDataFromMap(countMap) {
        return Array.from(countMap.entries())
            .map(([key, { count, originalCase }]) => ({
                key: key, // lowercase key for option value
                display: `${originalCase} (${count})`, // Formatted display text
                count: count
            }))
            .sort((a, b) => b.count - a.count); // Sort descending by count
    },

    /**
     * Gets sorted Pokémon data.
     * @returns {Array<{key: string, display: string, count: number}>} Sorted array
     */
    getPokemonSortedByCount() {
        return Array.from(this.pokemonIndex.entries())
             .map(([key, { count, originalCase }]) => ({
                 key: key,
                 display: `${originalCase} (${count})`,
                 count: count
             }))
             .sort((a, b) => b.count - a.count);
    },

    getItemsSortedByCount: () => DataService._getSortedDataFromMap(DataService.itemCounts),
    getMovesSortedByCount: () => DataService._getSortedDataFromMap(DataService.moveCounts),
    getAbilitiesSortedByCount: () => DataService._getSortedDataFromMap(DataService.abilityCounts),
    getTerasSortedByCount: () => DataService._getSortedDataFromMap(DataService.teraCounts), // If tera counting is used
    getAllTeraTypesLower: () => [...TERA_TYPES].sort(), // Keep alphabetical for static lists? Or count? Let's stick to alpha for static.
    getAllRolesLower: () => [...ROLES].sort(), // Keep alphabetical for static lists

    // NEW: Get specific abilities/moves for a given Pokémon, SORTED BY GLOBAL COUNT
    getAbilitiesForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        if (!pokemonData || !pokemonData.knownAbilities) return [];

        const knownAbilities = pokemonData.knownAbilities; // Set of lowerCase ability names
        return this.getAbilitiesSortedByCount()
            .filter(abilityData => knownAbilities.has(abilityData.key));
            // Already sorted by global count, just filter
    },

    getMovesForPokemonSorted(pokemonNameLower) {
        const pokemonData = this.pokemonIndex.get(pokemonNameLower);
        if (!pokemonData || !pokemonData.knownMoves) return [];

        const knownMoves = pokemonData.knownMoves; // Set of lowerCase move names
        return this.getMovesSortedByCount()
            .filter(moveData => knownMoves.has(moveData.key));
             // Already sorted by global count, just filter
    },

    // getOriginalCaseForSelect is likely no longer needed if display text is pre-formatted
    // getOriginalCaseForSelect(type, value) { ... } // Can be removed or commented out
};

// --- Team Matcher ---
// No changes needed in TeamMatcher logic based on this request.
// It already uses lowercase comparisons.
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

    // No changes needed below this line in TeamMatcher
    _checkSinglePokemonMatch(pokemon, pokemonCriterion) {
        if (!pokemon || !pokemonCriterion || pokemon.name?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.pokemonName?.toLowerCase()) return false;
        if (!pokemonCriterion.pokemonName) return false; // Must select a pokemon
        // Allow 'Any' (null/empty string) for sub-criteria
        if (pokemonCriterion.item && pokemon.item?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.item) return false;
        if (pokemonCriterion.ability && pokemon.ability?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.ability) return false;
        if (pokemonCriterion.tera && pokemon.tera_type?.toLowerCase() !== pokemonCriterion.tera) return false;

        const requiredMoves = [pokemonCriterion.move1, pokemonCriterion.move2, pokemonCriterion.move3, pokemonCriterion.move4].filter(Boolean);
        if (requiredMoves.length > 0) {
            const pokemonMovesLower = pokemon.moves?.map(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-')).filter(Boolean) || [];
            if (!requiredMoves.every(reqMove => pokemonMovesLower.includes(reqMove))) return false;
        }
        return true; // All specified criteria match
    },

     _calculateSinglePokemonMatchScore(pokemon, pokemonCriterion) {
         let singlePokemonScore = 0;
         if (!pokemon || !pokemonCriterion || !pokemonCriterion.pokemonName) return 0;
         const pokemonNameLower = pokemon.name?.toLowerCase().replace(/ /g, '-');
         const criterionNameLower = pokemonCriterion.pokemonName?.toLowerCase(); // Assume pokemonName is always lowercase from select value

         // Exact Pokemon name match is required for this block type
         if (pokemonNameLower !== criterionNameLower) return 0;

         singlePokemonScore += SCORE_WEIGHTS.POKEMON_FOUND;

         // Add score for matching sub-criteria if they are specified (not empty/null)
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
         // Simplified thresholds for example
         const ATK_THRESHOLD = 110, SPA_THRESHOLD = 110, DEF_THRESHOLD = 100, SPD_THRESHOLD = 100, SPE_THRESHOLD = 100, HP_THRESHOLD = 95;

         if ((role.includes("physical attacker") || role === "attacker") && stats.attack >= ATK_THRESHOLD) return true;
         if ((role.includes("special attack") || role === "special attacker") && stats['special-attack'] >= SPA_THRESHOLD) return true;
         // General attacker role matches either high physical or special attack
         if (role === "attacker" && (stats.attack >= ATK_THRESHOLD || stats['special-attack'] >= SPA_THRESHOLD)) return true;

         if ((role.includes("physical defense") || role === "defensive" || role === "defense") && stats.defense >= DEF_THRESHOLD) return true;
         if ((role.includes("special defense") || role === "specially defensive") && stats['special-defense'] >= SPD_THRESHOLD) return true;
          // General defensive role matches either high defense or special defense
         if ((role === "defensive" || role === "defense") && (stats.defense >= DEF_THRESHOLD || stats['special-defense'] >= SPD_THRESHOLD)) return true;

         if ((role.includes("speed") || role.includes("fast") || role.includes("speedy")) && stats.speed >= SPE_THRESHOLD) return true;
         if ((role.includes("bulk") || role.includes("hp") || role.includes("health")) && stats.hp >= HP_THRESHOLD) return true;
         // Wall implies higher defensive stats
         if (role.includes("wall") && (stats.defense >= DEF_THRESHOLD + 15 || stats['special-defense'] >= SPD_THRESHOLD + 15)) return true;
         // Bulky implies good HP and at least one good defensive stat
         if (role === "bulky" && stats.hp >= HP_THRESHOLD && (stats.defense >= DEF_THRESHOLD || stats['special-defense'] >= SPD_THRESHOLD)) return true;

         return false; // Role not matched
    },
};


// --- Generator ---
// No changes needed in Generator logic.
const Generator = {
    async findMatchingTeams(queryCriteria) {
        console.log(`Generator: Received query criteria:`, queryCriteria);
        try { await DataService.initialize(); }
        catch (error) { console.error("Generator: DataService initialization failed.", error); return []; }
        if (!DataService.isInitialized || !DataService.getTeams()) { console.error("Generator: Data service not ready."); return []; }
        if (!queryCriteria || queryCriteria.length === 0) { console.warn("Generator: Query criteria empty."); return []; }

        const allTeams = DataService.getTeams();
        const scoredTeams = [];
        console.log(`Generator: Scoring ${allTeams.length} teams...`);
        allTeams.forEach((team, index) => {
             if (!team || !Array.isArray(team.pokemons)) return; // Skip invalid teams
            try {
                const { score } = TeamMatcher.calculateMatchScore(queryCriteria, team);
                // Only include teams with a positive score
                if (score > 0) {
                    scoredTeams.push({ team, score, index });
                }
            } catch (error) {
                console.error(`Generator: Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error);
            }
        });
        console.log(`Generator: Found ${scoredTeams.length} teams with a positive score.`);

        // Sort by score descending
        scoredTeams.sort((a, b) => b.score - a.score);

        // Filter for the highest score (could be multiple teams)
        const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
        const bestTeamsRaw = maxScore > 0 ? scoredTeams.filter(st => st.score === maxScore) : [];

        console.log(`Generator: Top score is ${maxScore}. Found ${bestTeamsRaw.length} teams matching this score.`);

        // Simplify data for display
        return bestTeamsRaw.map(st => this._simplifyTeamData(st.team));
    },

    // No changes needed in _simplifyTeamData
    _simplifyTeamData(team) {
        // Use optional chaining and provide defaults
        return {
            filename: team?.filename || "unknown_filename.txt",
            pokemons: (team?.pokemons || []).map(p => {
                // Skip if essential data like name is missing
                if (!p?.name) return null;

                // Process moves safely
                const moves = Array.isArray(p.moves) ? p.moves : [];
                const processedMoves = moves.slice(0, 4).map(m => {
                    let name = null;
                    let type = 'unknown';
                    if (typeof m === 'object' && m?.name && m.name !== '-') {
                        name = m.name;
                        type = m.type?.toLowerCase() || 'unknown'; // Ensure type exists and is lowercase
                    } else if (typeof m === 'string' && m !== '-') {
                        name = m;
                        // Type is unknown if only name string is provided
                    }
                    return name ? { name, type } : null; // Return null if move name is invalid/missing
                }).filter(Boolean); // Filter out any null entries

                // Validate and normalize Tera Type
                const teraTypeLower = p.tera_type?.toLowerCase();
                const validTeraType = teraTypeLower && TERA_TYPES.includes(teraTypeLower) ? p.tera_type : null; // Store original case if valid

                // Provide default sprite safely
                const sprite = p.sprites?.front_default || null; // Use null if not available

                return {
                    name: p.name, // Assume name exists from initial check
                    ability: p.ability || null, // Use null if missing
                    item: (p.item && p.item !== "None") ? p.item : null, // Use null if missing or "None"
                    moves: processedMoves,
                    tera_type: validTeraType,
                    sprite: sprite,
                };
            }).filter(Boolean) // Remove any null Pokémon entries from the final array
        };
    }
};

// --- Global Exposure ---
window.generatePokepaste = async function(queryCriteria) {
    console.log("generatePokepaste called with query criteria:", queryCriteria);
    return await Generator.findMatchingTeams(queryCriteria);
};

// --- Auto-Initialize DataService ---
console.log("generate.js: Script loaded, attempting automatic DataService initialization...");
DataService.initialize().then(() => {
    document.dispatchEvent(new CustomEvent('dataReady'));
    console.log("generate.js: DataService ready, 'dataReady' event dispatched.");
}).catch(err => {
     console.error("generate.js: Automatic DataService initialization failed on load:", err);
});