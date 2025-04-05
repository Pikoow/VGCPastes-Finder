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
    pokemonIndex: new Map(),
    allItems: new Set(), // Still useful for validation potentially, contains Showdown + Dataset
    allMoves: new Set(), // Contains Showdown + Dataset
    allAbilities: new Set(), // Contains Showdown + Dataset
    itemsInDataset: new Set(), // NEW: Items found ONLY in processed_data.json
    movesInDataset: new Set(), // NEW: Moves found ONLY in processed_data.json
    abilitiesInDataset: new Set(), // NEW: Abilities found ONLY in processed_data.json
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
            console.log(`DataService: Found ${this.itemsInDataset.size} items, ${this.movesInDataset.size} moves, ${this.abilitiesInDataset.size} abilities within the dataset.`);
        } catch (error) {
            console.error("DataService: Initialization failed!", error);
            this.isInitialized = false;
            this.rawData = null;
            this.pokemonIndex.clear();
            this.allItems.clear();
            this.allMoves.clear();
            this.allAbilities.clear();
            this.itemsInDataset.clear();
            this.movesInDataset.clear();
            this.abilitiesInDataset.clear();
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
            this._preprocessRawData(); // This now populates pokemonIndex with known abilities/moves and the *InDataset sets
        } catch (error) {
            console.error('DataService: Error loading or preprocessing team data:', error);
            throw error;
        }

        // Fetch Showdown data to potentially validate against a wider list if needed
        // but UI dropdowns will primarily use *InDataset lists now.
        const results = await Promise.allSettled([
            this._fetchShowdownData(SHOWDOWN_ITEMS_URL, 'BattleItems', this.allItems),
            this._fetchShowdownData(SHOWDOWN_MOVES_URL, 'BattleMovedex', this.allMoves),
            this._fetchShowdownData(SHOWDOWN_ABILITIES_URL, 'BattleAbilities', this.allAbilities)
        ]);

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const url = [SHOWDOWN_ITEMS_URL, SHOWDOWN_MOVES_URL, SHOWDOWN_ABILITIES_URL][index];
                console.warn(`DataService: Failed to fetch or parse Showdown data from ${url}. Reason:`, result.reason);
            }
        });

        // Normalize the *global* lists from Showdown/Dataset (mainly for validation)
        this.allItems = new Set([...this.allItems].map(i => i?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allMoves = new Set([...this.allMoves].map(m => m?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));
        this.allAbilities = new Set([...this.allAbilities].map(a => a?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean));

        // Urshifu handling remains the same, affecting pokemonIndex
         if (this.pokemonIndex.has('urshifu')) {
            const urshifuData = this.pokemonIndex.get('urshifu');
             const rapidStrikeKey = 'urshifu-rapid-strike';
             const singleStrikeKey = 'urshifu-single-strike';

            if (!this.pokemonIndex.has(rapidStrikeKey)) {
                 const rapidStrikeData = JSON.parse(JSON.stringify(urshifuData)); // Deep copy
                 rapidStrikeData.originalCase = "Urshifu-Rapid-Strike";
                 // Ensure details are updated if possible, otherwise they inherit base form's
                 rapidStrikeData.details = rapidStrikeData.details || {}; // Ensure details object exists
                 rapidStrikeData.details.name = "Urshifu-Rapid-Strike";
                 // Copy known abilities/moves from base if needed, though ideally preprocess finds them separately
                 rapidStrikeData.knownAbilities = new Set(urshifuData.knownAbilities);
                 rapidStrikeData.knownMoves = new Set(urshifuData.knownMoves);
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
                this.pokemonIndex.set(singleStrikeKey, singleStrikeData);
                console.log(`DataService: Synthesized ${singleStrikeKey} from base Urshifu.`);
            }
        }

         // Ensure base Urshifu exists if forms do
         if (!this.pokemonIndex.has('urshifu') && (this.pokemonIndex.has('urshifu-rapid-strike') || this.pokemonIndex.has('urshifu-single-strike'))) {
             const formKey = this.pokemonIndex.has('urshifu-rapid-strike') ? 'urshifu-rapid-strike' : 'urshifu-single-strike';
             const form = this.pokemonIndex.get(formKey);
             const baseData = JSON.parse(JSON.stringify(form)); // Deep copy
             baseData.originalCase = "Urshifu";
             baseData.details = baseData.details || {};
             baseData.details.name = "Urshifu";
             // Initialize sets if they don't exist from the copy
             baseData.knownAbilities = new Set(form.knownAbilities || []);
             baseData.knownMoves = new Set(form.knownMoves || []);
             this.pokemonIndex.set('urshifu', baseData);
             console.log(`DataService: Synthesized base Urshifu from form ${formKey}.`);
         }
    },

    _preprocessRawData() {
        if (!this.rawData) return;
        this.itemsInDataset.clear();
        this.movesInDataset.clear();
        this.abilitiesInDataset.clear();
        this.pokemonIndex.clear(); // Clear before reprocessing

        this.rawData.forEach(team => {
            team.pokemons?.forEach(p => {
                if (!p?.name) return;

                const lowerName = p.name.toLowerCase().replace(/ /g, '-'); // Normalize name
                const itemLower = p.item?.toLowerCase().trim().replace(/ /g, '-');
                const abilityLower = p.ability?.toLowerCase().trim().replace(/ /g, '-');

                // Update or create entry in pokemonIndex
                if (!this.pokemonIndex.has(lowerName)) {
                    this.pokemonIndex.set(lowerName, {
                        originalCase: p.name,
                        details: p, // Store details from the first encounter
                        knownAbilities: new Set(),
                        knownMoves: new Set()
                    });
                }
                const pokemonEntry = this.pokemonIndex.get(lowerName);

                // Add ability to Pokémon's known list and global dataset list
                if (p.ability && abilityLower) {
                     pokemonEntry.knownAbilities.add(abilityLower);
                     this.abilitiesInDataset.add(abilityLower); // Add raw ability for now, normalize later if needed
                     this.allAbilities.add(p.ability); // Add original case to global list pre-normalization
                }

                // Add item to global dataset list
                if (p.item && p.item !== "None" && itemLower) {
                     this.itemsInDataset.add(itemLower);
                     this.allItems.add(p.item); // Add original case to global list pre-normalization
                }

                // Add moves to Pokémon's known list and global dataset list
                if (p.moves) {
                    p.moves.forEach(move => {
                        const moveName = (typeof move === 'object' ? move.name : move);
                        const moveNameLower = moveName?.toLowerCase().trim().replace(/ /g, '-');
                        if (moveName && moveName !== '-' && moveNameLower) {
                             pokemonEntry.knownMoves.add(moveNameLower);
                             this.movesInDataset.add(moveNameLower);
                             this.allMoves.add(moveName); // Add original case to global list pre-normalization
                        }
                    });
                }
            });
        });

        // Normalize the *InDataset sets AFTER iterating through all data
        this.itemsInDataset = new Set([...this.itemsInDataset].filter(Boolean));
        this.movesInDataset = new Set([...this.movesInDataset].filter(Boolean));
        this.abilitiesInDataset = new Set([...this.abilitiesInDataset].filter(Boolean));

        console.log(`DataService: Preprocessing complete. Found ${this.pokemonIndex.size} unique Pokémon entries.`);
        // Example: Log known abilities/moves for a specific Pokémon if it exists
        // if (this.pokemonIndex.has('pikachu')) {
        //     console.log("Pikachu known abilities:", [...this.pokemonIndex.get('pikachu').knownAbilities]);
        //     console.log("Pikachu known moves:", [...this.pokemonIndex.get('pikachu').knownMoves]);
        // }
    },


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
                    const parseFunc = new Function(`return ${dataBlock};`);
                    parsedData = parseFunc();
                } catch (e) {
                     console.error(`DataService: Failed to parse JSON-like structure for ${exportName} from ${url}. Error: ${e}`);
                     const nameRegex = /name:\s*"([^"]+)"/g;
                     let nameMatch;
                     while ((nameMatch = nameRegex.exec(dataBlock)) !== null) {
                         if (nameMatch[1]) targetSet.add(nameMatch[1]); // Add original case name
                     }
                     console.log(`DataService: Extracted names via REGEX fallback for ${exportName}.`);
                     return;
                }

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
        }
    },

    // --- Public Methods ---
    getTeams: () => DataService.rawData,
    getPokemonDetails: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.details,
    getOriginalCaseName: (name) => DataService.pokemonIndex.get(name?.toLowerCase())?.originalCase || name,
    isValidPokemon: (name) => DataService.pokemonIndex.has(name?.toLowerCase()),
    isValidItem: (name) => DataService.allItems.has(name?.toLowerCase().replace(/ /g, '-')), // Check against global list
    isValidMove: (name) => DataService.allMoves.has(name?.toLowerCase().replace(/ /g, '-')), // Check against global list
    isValidAbility: (name) => DataService.allAbilities.has(name?.toLowerCase().replace(/ /g, '-')), // Check against global list
    isValidTeraType: (name) => TERA_TYPES.includes(name?.toLowerCase()),
    isValidRole: (name) => ROLES.includes(name?.toLowerCase()),

    // --- Methods for Populating Selects ---
    getAllPokemonNamesLower: () => [...DataService.pokemonIndex.keys()].sort(),
    // Returns only items found in the dataset, sorted
    getItemsInDatasetLower: () => [...DataService.itemsInDataset].sort(),
    // Returns only moves found in the dataset, sorted (for general move criteria)
    getMovesInDatasetLower: () => [...DataService.movesInDataset].sort(),
     // Returns only abilities found in the dataset, sorted (for general ability criteria)
    getAbilitiesInDatasetLower: () => [...DataService.abilitiesInDataset].sort(),
    getAllTeraTypesLower: () => [...TERA_TYPES].sort(),
    getAllRolesLower: () => [...ROLES].sort(),

    // NEW: Get specific abilities/moves for a given Pokémon
    getAbilitiesForPokemon: (name) => {
        const pokemonData = DataService.pokemonIndex.get(name?.toLowerCase());
        return pokemonData && pokemonData.knownAbilities
            ? [...pokemonData.knownAbilities].sort()
            : []; // Return empty array if pokemon not found or has no known abilities
    },
    getMovesForPokemon: (name) => {
        const pokemonData = DataService.pokemonIndex.get(name?.toLowerCase());
        return pokemonData && pokemonData.knownMoves
            ? [...pokemonData.knownMoves].sort()
            : []; // Return empty array if pokemon not found or has no known moves
    },

    // Helper to get original casing for display in selects
    getOriginalCaseForSelect(type, value) {
         const lowerValue = value?.toLowerCase().replace(/ /g, '-'); // Ensure consistent format for lookup/capitalization
         if (!lowerValue) return value; // Return original if no lower value

        switch(type) {
            case 'pokemon':
                return this.getOriginalCaseName(lowerValue); // Use existing method which checks pokemonIndex
            case 'item':
            case 'ability':
            case 'move':
                 // Attempt to find original case from pokemonIndex details if possible (more accurate for dataset items)
                 // This is tricky because we only have the lowerValue ID here.
                 // A simple capitalization is often sufficient for display.
                return lowerValue.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            case 'tera':
            case 'role':
                // Simple capitalization for these known lists
                return lowerValue.charAt(0).toUpperCase() + lowerValue.slice(1);
            default: return value; // Fallback
        }
    }
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
             requiredMoves.forEach(reqMove => { if (pokemonMovesLower.has(reqMove)) singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_MOVE; });
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
             if (!team || !Array.isArray(team.pokemons)) return;
            try {
                const { score } = TeamMatcher.calculateMatchScore(queryCriteria, team);
                if (score > 0) scoredTeams.push({ team, score, index });
            } catch (error) { console.error(`Generator: Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error); }
        });
        console.log(`Generator: Found ${scoredTeams.length} teams with a positive score.`);

        scoredTeams.sort((a, b) => b.score - a.score);
        const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
        const bestTeamsRaw = maxScore > 0 ? scoredTeams.filter(st => st.score === maxScore) : [];
        console.log(`Generator: Top score is ${maxScore}. Found ${bestTeamsRaw.length} teams matching this score.`);
        return bestTeamsRaw.map(st => this._simplifyTeamData(st.team));
    },

    // No changes needed in _simplifyTeamData
    _simplifyTeamData(team) {
        return {
            filename: team?.filename || "unknown_filename.txt",
            pokemons: (team?.pokemons || []).map(p => {
                if (!p?.name) return null;
                const moves = Array.isArray(p.moves) ? p.moves : [];
                const processedMoves = moves.slice(0, 4).map(m => {
                    let name = null, type = 'unknown';
                    if (typeof m === 'object' && m?.name && m.name !== '-') { name = m.name; type = m.type?.toLowerCase() || 'unknown'; }
                    else if (typeof m === 'string' && m !== '-') { name = m; }
                    return name ? { name, type } : null;
                }).filter(Boolean);
                const teraTypeLower = p.tera_type?.toLowerCase();
                const validTeraType = teraTypeLower && TERA_TYPES.includes(teraTypeLower) ? p.tera_type : null;
                return {
                    name: p.name, ability: p.ability || null, item: (p.item && p.item !== "None") ? p.item : null,
                    moves: processedMoves, tera_type: validTeraType, sprite: p.sprites?.front_default || null,
                };
            }).filter(Boolean)
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