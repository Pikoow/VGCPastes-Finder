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
            console.log(`DataService: Loaded ${this.pokemonIndex.size} unique Pokémon, ${this.allItems.size} items, ${this.allMoves.size} moves, ${this.allAbilities.size} abilities.`);
        } catch (error) {
            console.error("DataService: Initialization failed!", error);
            this.isInitialized = false;
            this.rawData = null;
            this.pokemonIndex.clear();
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
            this._preprocessRawData();
        } catch (error) {
            console.error('DataService: Error loading or preprocessing team data:', error);
            throw error;
        }

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

        // Ensure lowercase and clean up sets AFTER fetching Showdown data
        this.allItems = new Set([...this.allItems].map(i => i?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean)); // Handle spaces in item names
        this.allMoves = new Set([...this.allMoves].map(m => m?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean)); // Handle spaces in move names
        this.allAbilities = new Set([...this.allAbilities].map(a => a?.toLowerCase().trim().replace(/ /g, '-')).filter(Boolean)); // Handle spaces in ability names


         // Special handling for Urshifu forms
         if (this.pokemonIndex.has('urshifu')) {
            const urshifuData = this.pokemonIndex.get('urshifu');
            if (!this.pokemonIndex.has('urshifu-rapid-strike')) {
                 // Attempt to synthesize reasonable data if possible, or just use base
                 const rapidStrikeData = JSON.parse(JSON.stringify(urshifuData)); // Deep copy
                 rapidStrikeData.originalCase = "Urshifu-Rapid-Strike";
                 rapidStrikeData.details.name = "Urshifu-Rapid-Strike";
                 // Potentially update types/stats if known, otherwise uses base Urshifu
                 this.pokemonIndex.set('urshifu-rapid-strike', rapidStrikeData);
            }
             if (!this.pokemonIndex.has('urshifu-single-strike')) {
                const singleStrikeData = JSON.parse(JSON.stringify(urshifuData)); // Deep copy
                singleStrikeData.originalCase = "Urshifu-Single-Strike";
                singleStrikeData.details.name = "Urshifu-Single-Strike";
                this.pokemonIndex.set('urshifu-single-strike', singleStrikeData);
            }
        }

         // Ensure base Urshifu exists if forms do
         if (!this.pokemonIndex.has('urshifu') && (this.pokemonIndex.has('urshifu-rapid-strike') || this.pokemonIndex.has('urshifu-single-strike'))) {
            const form = this.pokemonIndex.get('urshifu-rapid-strike') || this.pokemonIndex.get('urshifu-single-strike');
             const baseData = JSON.parse(JSON.stringify(form)); // Deep copy
             baseData.originalCase = "Urshifu";
             baseData.details.name = "Urshifu";
             this.pokemonIndex.set('urshifu', baseData);
         }

    },

    _preprocessRawData() {
        if (!this.rawData) return;
        this.rawData.forEach(team => {
            team.pokemons?.forEach(p => {
                if (p?.name) {
                    const lowerName = p.name.toLowerCase().replace(/ /g, '-'); // Normalize name
                    if (!this.pokemonIndex.has(lowerName)) {
                        this.pokemonIndex.set(lowerName, { originalCase: p.name, details: p });
                    }
                    // Collect raw names for Showdown matching later
                    if (p.ability) this.allAbilities.add(p.ability);
                    if (p.item) this.allItems.add(p.item);
                    if (p.moves) {
                        p.moves.forEach(move => {
                            const moveName = (typeof move === 'object' ? move.name : move);
                            if (moveName && moveName !== '-') this.allMoves.add(moveName);
                        });
                    }
                }
            });
        });
    },

    async _fetchShowdownData(url, exportName, targetSet) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            const text = await response.text();
            // Improved Regex: Handle potential variations in spacing and export methods
            const dataRegex = new RegExp(`(?:exports|this)\\.${exportName}\\s*=\\s*({[\\s\\S]*?});`);
            const match = text.match(dataRegex);

            if (match && match[1]) {
                const dataBlock = match[1];
                // Safer Eval: Wrap in a function scope to parse the object literal
                // WARNING: Still executes external code, but limits scope somewhat.
                // A more robust parser (like AST) is safer but much more complex.
                let parsedData = {};
                try {
                    // Use Function constructor for safer evaluation than direct eval()
                    const parseFunc = new Function(`return ${dataBlock};`);
                    parsedData = parseFunc();
                } catch (e) {
                     console.error(`DataService: Failed to parse JSON-like structure for ${exportName} from ${url}. Error: ${e}`);
                     // Fallback to regex if direct parsing fails (less reliable)
                     const nameRegex = /name:\s*"([^"]+)"/g;
                     let nameMatch;
                     while ((nameMatch = nameRegex.exec(dataBlock)) !== null) {
                         if (nameMatch[1]) targetSet.add(nameMatch[1]);
                     }
                     console.log(`DataService: Extracted names via REGEX fallback for ${exportName}.`);
                     return; // Exit after fallback
                }


                // Iterate through the parsed object's keys (which are often IDs)
                for (const key in parsedData) {
                    if (parsedData[key] && parsedData[key].name) {
                        targetSet.add(parsedData[key].name);
                    }
                }
                console.log(`DataService: Successfully parsed/extracted names for ${exportName} from ${url}`);

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
    isValidItem: (name) => DataService.allItems.has(name?.toLowerCase()),
    isValidMove: (name) => DataService.allMoves.has(name?.toLowerCase()),
    isValidAbility: (name) => DataService.allAbilities.has(name?.toLowerCase()),
    isValidTeraType: (name) => TERA_TYPES.includes(name?.toLowerCase()),
    isValidRole: (name) => ROLES.includes(name?.toLowerCase()),

    // Get lists sorted alphabetically, ensuring lowercase and handling potential non-strings
    getAllPokemonNamesLower: () => [...DataService.pokemonIndex.keys()].sort(),
    getAllItemsLower: () => [...DataService.allItems].filter(i => typeof i === 'string').map(i => i.toLowerCase()).sort(),
    getAllMovesLower: () => [...DataService.allMoves].filter(m => typeof m === 'string').map(m => m.toLowerCase()).sort(),
    getAllAbilitiesLower: () => [...DataService.allAbilities].filter(a => typeof a === 'string').map(a => a.toLowerCase()).sort(),
    getAllTeraTypesLower: () => [...TERA_TYPES].sort(), // Already lowercase
    getAllRolesLower: () => [...ROLES].sort(), // Already lowercase

    // Helper to get original casing for display in selects, converting ID back
    getOriginalCaseForSelect(type, value) {
        const lowerValue = value?.toLowerCase();
        switch(type) {
            case 'pokemon': return this.getOriginalCaseName(lowerValue);
            case 'item':
            case 'ability':
            case 'move':
                 // Find the original case from the respective Set (less efficient, but needed if Showdown fetch succeeded)
                 // This assumes the sets contain original casing from Showdown before being lowercased later
                 // Let's refine this: Store original cases alongside lowercased versions if needed,
                 // OR just capitalize the lowercased ID for display (simpler).
                return lowerValue.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            case 'tera':
            case 'role':
                return lowerValue.charAt(0).toUpperCase() + lowerValue.slice(1); // Simple capitalization
            default: return value;
        }
    }
};

// --- Team Matcher ---
// Adapts to the new structured query format.
const TeamMatcher = {

    // Calculates score based on the structured query array.
    calculateMatchScore(queryCriteria, team) {
        let score = 0;
        const teamPokemons = team?.pokemons || [];
        if (!queryCriteria || !Array.isArray(queryCriteria) || teamPokemons.length === 0) {
            return { score: 0 };
        }

        // Use simple flags/counters instead of complex metCriteria sets for this version
        let criteriaMatches = 0;

        // Iterate through each criterion block in the user's query
        queryCriteria.forEach(criterion => {
            let criterionSatisfied = false;

            switch (criterion.type) {
                case 'pokemon':
                    // Find if any Pokémon in the team matches this specific criterion block
                    criterionSatisfied = teamPokemons.some(p => this._checkSinglePokemonMatch(p, criterion));
                    if (criterionSatisfied) {
                        // Base score for finding a matching Pokémon setup
                        // More nuanced scoring happens within _checkSinglePokemonMatch (applied once per team)
                        // Let's adjust: Score is calculated *per matching Pokémon* to reward teams with multiple fits?
                        // Or calculate total score based on *if* the criteria block is met at least once?
                        // Let's stick to: "If *any* pokemon on the team matches this block, add score based on *how well* it matched"
                        // We need to find the *best* matching pokemon for this criterion on the team.
                        let bestMatchScoreForCriterion = 0;
                        teamPokemons.forEach(p => {
                             bestMatchScoreForCriterion = Math.max(bestMatchScoreForCriterion, this._calculateSinglePokemonMatchScore(p, criterion));
                        });
                        score += bestMatchScoreForCriterion;
                        if (bestMatchScoreForCriterion > 0) criteriaMatches++;

                    }
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

        // Bonus for matching multiple criteria? Or just sum? Sum is simpler.
        // Ensure score is non-negative
        const finalScore = Math.max(0, score);

        // Return just the score
        return { score: finalScore };
    },

    // Checks if a *single* team Pokémon matches a *specific* Pokémon criterion block from the query.
    // Used for boolean checks if needed, but scoring is separate now.
    _checkSinglePokemonMatch(pokemon, pokemonCriterion) {
        if (!pokemon || !pokemonCriterion || pokemon.name?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.pokemonName?.toLowerCase()) {
            return false; // Names must match first (handle case where pokemonName isn't selected yet?)
        }
         if (!pokemonCriterion.pokemonName) return false; // Don't match if no pokemon is selected in the criterion

        // Check Item (if specified in criterion)
        if (pokemonCriterion.item && pokemon.item?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.item) {
            return false;
        }
        // Check Ability (if specified)
        if (pokemonCriterion.ability && pokemon.ability?.toLowerCase().replace(/ /g, '-') !== pokemonCriterion.ability) {
            return false;
        }
        // Check Tera (if specified)
        if (pokemonCriterion.tera && pokemon.tera_type?.toLowerCase() !== pokemonCriterion.tera) {
            return false;
        }
        // Check Moves (if specified) - Check if *all* specified moves are present
        const requiredMoves = [
            pokemonCriterion.move1,
            pokemonCriterion.move2,
            pokemonCriterion.move3,
            pokemonCriterion.move4
        ].filter(Boolean); // Get only the moves actually selected in the criterion

        if (requiredMoves.length > 0) {
            const pokemonMovesLower = pokemon.moves?.map(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-')).filter(Boolean) || [];
            const hasAllMoves = requiredMoves.every(reqMove => pokemonMovesLower.includes(reqMove));
            if (!hasAllMoves) {
                return false;
            }
        }

        // If all checks passed (or weren't required)
        return true;
    },

     // Calculates the score contribution if a specific team Pokémon matches a Pokémon criterion block.
     _calculateSinglePokemonMatchScore(pokemon, pokemonCriterion) {
         let singlePokemonScore = 0;
          if (!pokemon || !pokemonCriterion || !pokemonCriterion.pokemonName) {
             return 0; // No match if essential data is missing
         }
         const pokemonNameLower = pokemon.name?.toLowerCase().replace(/ /g, '-');
         const criterionNameLower = pokemonCriterion.pokemonName?.toLowerCase();

          if (pokemonNameLower !== criterionNameLower) {
             return 0; // Names must match
         }

         // Base score for matching the Pokémon itself
         singlePokemonScore += SCORE_WEIGHTS.POKEMON_FOUND;

         // Add score for matching details
         if (pokemonCriterion.item && pokemon.item?.toLowerCase().replace(/ /g, '-') === pokemonCriterion.item) {
             singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_ITEM;
         }
         if (pokemonCriterion.ability && pokemon.ability?.toLowerCase().replace(/ /g, '-') === pokemonCriterion.ability) {
             singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_ABILITY;
         }
         if (pokemonCriterion.tera && pokemon.tera_type?.toLowerCase() === pokemonCriterion.tera) {
             singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_TERA;
         }

         // Check Moves: Add score for *each* matching move specified in the criterion
         const requiredMoves = [
             pokemonCriterion.move1,
             pokemonCriterion.move2,
             pokemonCriterion.move3,
             pokemonCriterion.move4
         ].filter(Boolean);

         if (requiredMoves.length > 0) {
             const pokemonMovesLower = new Set(pokemon.moves?.map(m => (typeof m === 'object' ? m.name : m)?.toLowerCase().replace(/ /g, '-')).filter(Boolean) || []);
             requiredMoves.forEach(reqMove => {
                 if (pokemonMovesLower.has(reqMove)) {
                     singlePokemonScore += SCORE_WEIGHTS.POKEMON_WITH_MOVE;
                 }
             });
         }

         return singlePokemonScore;
     },


    // Helper function to check if a Pokémon fits a requested role based on its stats. (Keep for GENERAL_ROLE)
     _checkPokemonRole(pokemon, role) {
         const stats = pokemon?.stats;
         if (!stats) return false;
         role = role?.toLowerCase();
         if (!role) return false;

         const ATK_THRESHOLD = 110;
         const SPA_THRESHOLD = 110;
         const DEF_THRESHOLD = 100;
         const SPD_THRESHOLD = 100;
         const SPE_THRESHOLD = 100;
         const HP_THRESHOLD = 95;

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

    // Removed helpers: _createEmptyMetCriteriaSets, _convertMetCriteriaSetsToArray
};


// --- Generator ---
// Main orchestrator, simplified for the new query structure.
const Generator = {

    // Takes the structured query array built by the UI.
    async findMatchingTeams(queryCriteria) {
        console.log(`Generator: Received query criteria:`, queryCriteria);

        // 1. Ensure data is loaded.
        try {
            await DataService.initialize();
        } catch (error) {
             console.error("Generator: DataService initialization failed. Cannot proceed.", error);
             // Return an empty array and maybe signal error differently?
             // For now, let script.js handle the empty array as "Error or No Results".
             return [];
        }

        if (!DataService.isInitialized || !DataService.getTeams()) {
            console.error("Generator: Data service is not ready after initialization attempt.");
             return [];
        }

        // 2. Basic check: Is the query empty?
        if (!queryCriteria || queryCriteria.length === 0) {
            console.warn("Generator: Query criteria array is empty. Nothing to search for.");
            // Return empty array, let UI show initial message or "Build a query".
            return [];
        }

        // 3. Score all teams against the structured query.
        const allTeams = DataService.getTeams();
        const scoredTeams = [];

        console.log(`Generator: Scoring ${allTeams.length} teams...`);
        allTeams.forEach((team, index) => {
             if (!team || !Array.isArray(team.pokemons)) {
                  // console.warn(`Generator: Skipping invalid team structure at index ${index}`);
                 return;
             }

            try {
                const { score } = TeamMatcher.calculateMatchScore(queryCriteria, team);

                // Only consider teams with a positive score.
                if (score > 0) {
                    scoredTeams.push({ team, score, index });
                }
            } catch (error) {
                console.error(`Generator: Error matching team index ${index} (Filename: ${team?.filename || 'N/A'}):`, error);
            }
        });
        console.log(`Generator: Found ${scoredTeams.length} teams with a positive score.`);

        // 4. Rank teams by score.
        scoredTeams.sort((a, b) => b.score - a.score);

        // 5. Select all teams tied for the best score.
        const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
        const bestTeamsRaw = maxScore > 0 ? scoredTeams.filter(st => st.score === maxScore) : [];
        console.log(`Generator: Top score is ${maxScore}. Found ${bestTeamsRaw.length} teams matching this score.`);

        // 6. Format the best teams.
        const simplifiedTeams = bestTeamsRaw.map(st => this._simplifyTeamData(st.team));

        // 7. Return the results (just the array of teams).
        return simplifiedTeams;
    },

    // --- Helper Methods --- (Removed unused helpers)

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

                return {
                    name: p.name,
                    ability: p.ability || null,
                    item: (p.item && p.item !== "None") ? p.item : null,
                    moves: processedMoves,
                    tera_type: validTeraType,
                    sprite: p.sprites?.front_default || null,
                };
            }).filter(Boolean)
        };
    }
};

// --- Global Exposure ---
// Expose the Generator's method.
window.generatePokepaste = async function(queryCriteria) {
    console.log("generatePokepaste called with query criteria:", queryCriteria);
    return await Generator.findMatchingTeams(queryCriteria);
};

// --- Auto-Initialize DataService ---
console.log("generate.js: Script loaded, attempting automatic DataService initialization...");
DataService.initialize().then(() => {
    // Optionally, trigger an event or callback here to signal data readiness to script.js
    // This ensures UI elements that need data (like selects) are populated correctly.
    document.dispatchEvent(new CustomEvent('dataReady'));
    console.log("generate.js: DataService ready, 'dataReady' event dispatched.");
}).catch(err => {
     console.error("generate.js: Automatic DataService initialization failed on load:", err);
     // Potentially disable the query builder UI here.
});