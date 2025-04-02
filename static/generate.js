// Load processed data
let data;
let dataLoaded = new Promise(resolve => {
    fetch('https://pikoow.github.io/VGCPastes-Finder/data/processed_data.json')
        .then(response => response.json())
        .then(jsonData => {
            data = jsonData;
            resolve();
        })
        .catch(error => {
            console.error('Error loading processed data:', error);
            resolve(); // Still resolve to prevent hanging
        });
});

let allItems = [];
let allMoves = [];
let allAbilities = new Set();
let pokemonNames = new Set();

// Define size/weight thresholds (adjust as needed)
const SMALL_THRESHOLD = 5; // Height in decimetres (e.g., <= 0.5m)
const TALL_THRESHOLD = 20; // Height in decimetres (e.g., >= 2.0m)
const LIGHT_THRESHOLD = 100; // Weight in hectograms (e.g., <= 10.0kg)
const HEAVY_THRESHOLD = 2000; // Weight in hectograms (e.g., >= 200.0kg)


async function initializeData() {
    await dataLoaded;
    if (!data) {
        console.error("Data failed to load, cannot initialize.");
        return;
    }
    // Cache all Pokémon names
    data.forEach(team => {
        team.pokemons.forEach(p => {
            if (p && p.name) {
                pokemonNames.add(p.name.toLowerCase());
                if (p.ability) allAbilities.add(p.ability.toLowerCase());
            }
        });
    });

    // Pre-process moves from existing data
    data.forEach(team => {
        team.pokemons.forEach(p => {
            if (p && p.moves) {
                p.moves.forEach(move => {
                    const moveName = (typeof move === 'object' && move !== null ? move.name : move)?.toLowerCase();
                    if (moveName) allMoves.push(moveName);
                });
            }
        });
    });

    // Remove duplicates
    allMoves = [...new Set(allMoves)];

    window.pokemonNames = pokemonNames;
}

async function fetchAllItems() {
    if (allItems.length > 0) return allItems; // Return cached items

    const url = "https://play.pokemonshowdown.com/data/items.js";
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);

        const text = await response.text();
        // Improved regex to handle potential variations in formatting
        const itemsMatch = text.match(/exports\.BattleItems\s*=\s*({[\s\S]*?});/);
        if (itemsMatch && itemsMatch[1]) {
            const itemsData = itemsMatch[1];
            // Extract names more robustly
            const names = [];
            const nameRegex = /name:\s*"([^"]+)"/g;
            let match;
            while ((match = nameRegex.exec(itemsData)) !== null) {
                names.push(match[1].toLowerCase());
            }
            allItems = names;
        } else {
             console.warn("Could not parse items data from Showdown.");
             allItems = []; // Fallback or keep existing if partially loaded
        }
        return allItems;
    } catch (error) {
        console.error('Error fetching items:', error);
        return [];
    }
}

async function fetchAllMoves() {
    // Keep pre-processed moves from data, only fetch if needed or to supplement
    if (allMoves.length > 0) {
         // Optional: Fetch from Showdown to potentially get more moves not in the dataset
         // return allMoves; // Uncomment this line if you ONLY want moves from your dataset
    }

    const url = "https://play.pokemonshowdown.com/data/moves.js";
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);

        const text = await response.text();
        const movesMatch = text.match(/exports\.BattleMovedex\s*=\s*({[\s\S]*?});/);
         if (movesMatch && movesMatch[1]) {
            const movesData = movesMatch[1];
            const showdownMoves = [];
            const nameRegex = /name:\s*"([^"]+)"/g;
            let match;
            while ((match = nameRegex.exec(movesData)) !== null) {
                showdownMoves.push(match[1].toLowerCase());
            }
            // Combine moves from data and showdown, then remove duplicates
            allMoves = [...new Set([...allMoves, ...showdownMoves])];
        } else {
             console.warn("Could not parse moves data from Showdown.");
             // Keep moves parsed from dataset if fetch fails
        }
        return allMoves;
    } catch (error) {
        console.error('Error fetching moves:', error);
        // Keep moves parsed from dataset if fetch fails
        return allMoves.length > 0 ? allMoves : [];
    }
}

async function loadAllData() {
    // Initialize first to get base lists from data
    await initializeData();
    // Then fetch from Showdown to potentially supplement lists
    await Promise.all([fetchAllItems(), fetchAllMoves()]);

    // Ensure data loaded before proceeding
    if (!data) {
        console.error("Critical error: Processed data is not available.");
        // Handle this case appropriately in the UI, maybe show an error message
        return;
    }

    // Final check and logging
    /*console.log('Data loaded - Pokémon names:', pokemonNames);
    console.log('Data loaded - Abilities:', allAbilities);
    console.log('Data loaded - Moves:', allMoves);
    console.log('Data loaded - Items:', allItems);*/
}

loadAllData().catch(console.error);

function parseInstruction(instruction) {
    const parsed = {
        pokemon: [],
        pokemon_with_items: [],
        pokemon_with_tera: [],
        pokemon_with_abilities: [],
        pokemon_with_moves: [],
        types_with_roles: [],
        types: [],
        roles: [],
        moves: [],
        abilities: [],
        size_requests: [], // Added: { type: 'small' | 'tall', count: number }
        weight_requests: [] // Added: { type: 'light' | 'heavy', count: number }
    };

    const lowerInstruction = instruction.toLowerCase();
    const pokemonReferences = [];

    // First, find all Pokémon mentions and their positions
    if (pokemonNames && pokemonNames.size > 0) {
        [...pokemonNames].forEach(name => {
            if (!name) return; // Skip if name is undefined/null
            // Use word boundaries and exact matching for Pokémon names
            // Escape hyphens correctly
            const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(^|\\s)${escapedName}(?=$|\\s|'s|-)`, 'gi'); // Lookahead for space, end, 's, or -
            let match;
            while ((match = regex.exec(lowerInstruction)) !== null) {
                 // Find the original casing from the data if possible
                 let originalCaseName = name; // Default to lower if not found (shouldn't happen often)
                 // This assumes `data` is loaded and contains team structures.
                 // A more robust way might be to have a separate map of lowerCase -> OriginalCase
                 if (data && data.length > 0 && data[0].pokemons) {
                     const foundPokemon = data.flatMap(t => t.pokemons).find(p => p && p.name && p.name.toLowerCase() === name);
                     if (foundPokemon) {
                         originalCaseName = foundPokemon.name;
                     }
                 }

                pokemonReferences.push({
                    name: originalCaseName, // Use original casing
                    position: match.index,
                    lowerName: name // Keep lowerName for matching logic
                });
            }
        });
    }


    // Sort by position to process in order
    pokemonReferences.sort((a, b) => a.position - b.position);

    // Remove duplicates and prefer longer names (like Landorus-Therian over Landorus)
    const uniquePokemon = [];
    pokemonReferences.forEach(ref => {
        // Check if a name that *contains* this ref already exists OR if this ref *contains* an existing name
         const isSubstring = uniquePokemon.some(p => p.lowerName.includes(ref.lowerName) && p.lowerName !== ref.lowerName);
         const isSuperstring = uniquePokemon.some(p => ref.lowerName.includes(p.lowerName) && p.lowerName !== ref.lowerName);

         if (isSubstring) {
             // A longer name (e.g., Landorus-Therian) is already present, ignore the shorter one (Landorus)
             return;
         } else if (isSuperstring) {
             // This ref is longer (e.g., Landorus-Therian), replace the shorter one (Landorus)
             const indexToRemove = uniquePokemon.findIndex(p => ref.lowerName.includes(p.lowerName));
             if (indexToRemove !== -1) {
                 uniquePokemon.splice(indexToRemove, 1, ref); // Replace
             } else {
                  uniquePokemon.push(ref); // Should not happen if logic is correct, but fallback
             }
         } else if (!uniquePokemon.some(p => p.lowerName === ref.lowerName)) {
             // It's a new, unrelated name
             uniquePokemon.push(ref);
         }
    });


    parsed.pokemon = uniquePokemon.map(ref => ref.name); // Store original case names

    // Process each Pokémon reference for items, moves, abilities
    for (let i = 0; i < uniquePokemon.length; i++) {
        const currentPokemon = uniquePokemon[i];
        const nextPokemon = i < uniquePokemon.length - 1 ? uniquePokemon[i + 1] : null;

        // Extract the text relevant to this Pokémon (from current position to next Pokémon or end)
        const start = currentPokemon.position + currentPokemon.lowerName.length; // Use lowerName length for slicing lowerInstruction
        const end = nextPokemon ? nextPokemon.position : lowerInstruction.length;
        const pokemonText = lowerInstruction.slice(start, end).trim();

        // Look for "with" or "holding" clauses
        const withMatch = pokemonText.match(/\b(?:with|holding)\b/);
        if (withMatch) {
            const afterWith = pokemonText.slice(withMatch.index + withMatch[0].length).trim();

            // Split by commas or "and" but be careful with "and" in move names
            // Regex improved to better handle names with 'and' like "Swords Dance" vs separator "and"
            const itemsAndDetails = afterWith.split(/\s*,\s*|\s+\band\b\s+(?!\w+[-']?\w+\s)/)
                                            .map(p => p.trim())
                                            .filter(p => p);


            for (const part of itemsAndDetails) {
                 let found = false;
                // Check for items first (often more specific)
                for (const item of allItems) {
                    if (item && new RegExp(`(^|\\s)${item.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part)) {
                        parsed.pokemon_with_items.push({
                            pokemon: currentPokemon.name, // Use original case name
                            item: item // Store lower case item name for matching
                        });
                         found = true;
                         break; // Assume only one item per part
                    }
                }
                 if (found) continue; // If item found, move to next part

                // Check for abilities - only if they're not part of a Pokémon name
                for (const ability of allAbilities) {
                     if (ability &&
                         new RegExp(`(^|\\s)${ability.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part) &&
                         !uniquePokemon.some(p => p.lowerName.includes(ability))) {
                        parsed.pokemon_with_abilities.push({
                            pokemon: currentPokemon.name, // Use original case name
                            ability: ability // Store lower case ability name
                        });
                         found = true;
                        break; // Assume only one ability per part
                    }
                }
                 if (found) continue; // If ability found, move to next part

                // Check for moves - only if they're not part of a Pokémon name or ability
                for (const move of allMoves) {
                     if (move &&
                         new RegExp(`(^|\\s)${move.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part) &&
                         !uniquePokemon.some(p => p.lowerName.includes(move)) &&
                         !parsed.pokemon_with_abilities.some(a => a.ability === move)) { // Avoid matching moves that are also ability names here
                        parsed.pokemon_with_moves.push({
                            pokemon: currentPokemon.name, // Use original case name
                            move: move // Store lower case move name
                        });
                         // Don't break here, could mention multiple moves
                    }
                }
            }
        }
    }

    // Detect Pokémon with specific Tera types
    const teraTypes = ["steel", "fighting", "dragon", "water", "electric", "fairy", "fire", "ice", "bug", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"];
    teraTypes.forEach(tera => {
        // Regex to find "pokemon name tera type" pattern
         const teraRegex = new RegExp(`(${uniquePokemon.map(p => p.lowerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\s+tera\\s+${tera}\\b`, 'gi');
         let teraMatch;
         while ((teraMatch = teraRegex.exec(lowerInstruction)) !== null) {
            const pokemonNameLower = teraMatch[1];
            // Find the original case name matching the lower case name found
            const originalPokemon = uniquePokemon.find(p => p.lowerName === pokemonNameLower);
             if (originalPokemon) {
                parsed.pokemon_with_tera.push({
                     pokemon: originalPokemon.name, // Use original case name
                     tera_type: tera
                });
            }
         }
          // Also check for general "tera type" mentions not tied to a specific Pokémon in the "with" clause
          if (new RegExp(`\\btera\\s+${tera}\\b`).test(lowerInstruction) && !parsed.pokemon_with_tera.some(pt => pt.tera_type === tera)) {
              // If the instruction mentions "tera [type]" generally, and we haven't already assigned it to a Pokémon
              // We might want a separate field for general tera requests, or just leave it unassigned for now.
              // Let's assume for now it must be linked to a Pokemon mention like "Gholdengo tera steel"
          }
    });

     // --- NEW: Parse Size and Weight Requests ---
     const sizeWeightRegex = /(\d+)\s+(small|tall|light|heavy)(?:\s+pokemon|\s+pokemons)?/gi;
     let sizeWeightMatch;
     while ((sizeWeightMatch = sizeWeightRegex.exec(lowerInstruction)) !== null) {
         const count = parseInt(sizeWeightMatch[1], 10);
         const type = sizeWeightMatch[2];

         if (!isNaN(count) && count > 0) {
             if (type === 'small' || type === 'tall') {
                 parsed.size_requests.push({ type, count });
             } else if (type === 'light' || type === 'heavy') {
                 parsed.weight_requests.push({ type, count });
             }
         }
     }
     // --- END NEW ---


    // Detect specific moves (general request, not tied to a Pokémon in "with" clause)
    allMoves.forEach(move => {
        if (move &&
            new RegExp(`(^|\\s)${move.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(lowerInstruction) &&
            !parsed.pokemon_with_moves.some(pm => pm.move === move) && // Not already assigned via "with"
            !uniquePokemon.some(p => p.lowerName.includes(move))) { // Not part of a pokemon name
            parsed.moves.push(move);
        }
    });

    // Detect specific abilities (general request)
    [...allAbilities].forEach(ability => {
        if (ability &&
            new RegExp(`(^|\\s)${ability.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(lowerInstruction) &&
            !parsed.pokemon_with_abilities.some(pa => pa.ability === ability) && // Not already assigned via "with"
            !uniquePokemon.some(p => p.lowerName.includes(ability))) { // Not part of a pokemon name
            parsed.abilities.push(ability);
        }
    });


    // Detect Types with specific roles (Simplified for now)
    const roles = {
        "strong attacker": ["attack", "physical attacker", "attacker"],
        "strong special attacker": ["special attack", "special attacker"],
        "defensive": ["defense", "defensive", "physical defense"],
        "specially defensive": ["special defense", "specially defensive"],
        "speedy": ["speed", "speedy", "fast"],
        "bulky": ["bulky", "hp", "health"],
        "wall": ["wall"]
    };
    Object.entries(roles).forEach(([role, keywords]) => {
        if (keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(lowerInstruction))) {
            parsed.roles.push(role); // General role request

             // Link type to role if found together
             teraTypes.forEach(type => { // Use teraTypes list as it's comprehensive
                 // Look for patterns like "[type] [role]", "[role] [type]", "[type]-type [role]", etc.
                 if (new RegExp(`\\b${type}(?:-type)?\\b.*\\b(${keywords.join('|')})\\b|\\b(${keywords.join('|')})\\b.*\\b${type}(?:-type)?\\b`, 'i').test(lowerInstruction)) {
                     // Check if this specific type-role pair already exists
                    if (!parsed.types_with_roles.some(tr => tr.type === type && tr.role === role)) {
                         parsed.types_with_roles.push({ type, role });
                    }
                }
             });
        }
    });


    // Detect general type mentions (e.g., "a water type")
    teraTypes.forEach(type => {
         // Look for "[type] type" or just the type name if it's unlikely to be part of another word
         // Use word boundaries to avoid matching substrings like "dragonite" for "dragon"
         if (new RegExp(`\\b${type}(?:-type)?\\b`, 'i').test(lowerInstruction)) {
            // Add only if not already added via type-role requests
             if (!parsed.types.includes(type) && !parsed.types_with_roles.some(tr => tr.type === type)) {
                 parsed.types.push(type);
             }
         }
    });

    return parsed;
}


function matchTeam(instruction, team) {
    const parsed = parseInstruction(instruction);
    let matchCount = 0;

     // --- Basic Data Check ---
     if (!team || !team.pokemons || team.pokemons.length === 0) {
         return 0; // Cannot match an empty or invalid team
     }

    // Check for Pokémon in the instruction
    parsed.pokemon.forEach(requestedPokemonName => {
         // Match using original case names from parsed instruction against original case names in team data
        if (team.pokemons.some(p => p && p.name === requestedPokemonName)) {
            matchCount += 100; // High score for specific Pokémon match
        }
    });

    // Check for Pokémon with specific items
    parsed.pokemon_with_items.forEach(pokemonItem => {
        team.pokemons.forEach(p => {
            // Match original case pokemon name, lower case item name
            if (p && p.name === pokemonItem.pokemon && p.item?.toLowerCase() === pokemonItem.item) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific Tera types
    parsed.pokemon_with_tera.forEach(pokemonTera => {
        team.pokemons.forEach(p => {
            // Match original case pokemon name, lower case tera type
             if (p && p.name === pokemonTera.pokemon && p.tera_type?.toLowerCase() === pokemonTera.tera_type) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific abilities
    parsed.pokemon_with_abilities.forEach(pokemonAbility => {
        team.pokemons.forEach(p => {
             // Match original case pokemon name, lower case ability
             if (p && p.name === pokemonAbility.pokemon && p.ability?.toLowerCase() === pokemonAbility.ability) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific moves
    parsed.pokemon_with_moves.forEach(pokemonMove => {
        team.pokemons.forEach(p => {
             if (p && p.name === pokemonMove.pokemon) {
                 const hasMove = p.moves?.some(m => {
                     // Handle both string and object move formats
                     const moveName = (typeof m === 'object' && m !== null ? m.name : m)?.toLowerCase();
                     return moveName === pokemonMove.move; // Match lower case move name
                 });
                 if (hasMove) {
                     matchCount += 25; // Lower score than item/ability/tera, but still significant
                 }
            }
        });
    });

     // --- NEW: Check Size and Weight Requests ---
     parsed.size_requests.forEach(req => {
         let count = 0;
         team.pokemons.forEach(p => {
             if (p && p.height !== null && p.height !== undefined) {
                 if (req.type === 'small' && p.height <= SMALL_THRESHOLD) {
                     count++;
                 } else if (req.type === 'tall' && p.height >= TALL_THRESHOLD) {
                     count++;
                 }
             }
         });
         if (count >= req.count) { // Check if team has *at least* the required number
             matchCount += 40; // Add score for fulfilling the size request
         }
     });

     parsed.weight_requests.forEach(req => {
         let count = 0;
         team.pokemons.forEach(p => {
             if (p && p.weight !== null && p.weight !== undefined) {
                 if (req.type === 'light' && p.weight <= LIGHT_THRESHOLD) {
                     count++;
                 } else if (req.type === 'heavy' && p.weight >= HEAVY_THRESHOLD) {
                     count++;
                 }
             }
         });
         if (count >= req.count) { // Check if team has *at least* the required number
             matchCount += 40; // Add score for fulfilling the weight request
         }
     });
     // --- END NEW ---

    // Check for specific moves generally in the team
    parsed.moves.forEach(move => {
         const hasMove = team.pokemons.some(p =>
             p && p.moves?.some(m => {
                 const moveName = (typeof m === 'object' && m !== null ? m.name : m)?.toLowerCase();
                 return moveName === move; // Match lower case move name
             })
         );
         if (hasMove) {
             matchCount += 15; // Lower score for general move presence
         }
    });

     // Check for specific abilities generally in the team
     parsed.abilities.forEach(ability => {
         const hasAbility = team.pokemons.some(p => p && p.ability?.toLowerCase() === ability); // Match lower case ability
         if (hasAbility) {
             matchCount += 15; // Lower score for general ability presence
         }
     });


    // Check for Types with specific roles (simplified check based on base stats)
    parsed.types_with_roles.forEach(typeRole => {
         team.pokemons.forEach(p => {
             if (p && p.types?.some(type => type.toLowerCase() === typeRole.type.toLowerCase())) {
                 const stats = p.stats || {};
                 let roleMatch = false;
                 // Basic stat check (adjust thresholds as needed)
                 if ((typeRole.role === "strong attacker") && stats.attack >= 110) roleMatch = true;
                 if ((typeRole.role === "strong special attacker") && stats['special-attack'] >= 110) roleMatch = true;
                 if ((typeRole.role === "defensive") && stats.defense >= 100) roleMatch = true;
                 if ((typeRole.role === "specially defensive") && stats['special-defense'] >= 100) roleMatch = true;
                 if ((typeRole.role === "speedy") && stats.speed >= 100) roleMatch = true;
                 if ((typeRole.role === "bulky") && stats.hp >= 100) roleMatch = true;
                 if ((typeRole.role === "wall") && (stats.defense >= 110 || stats['special-defense'] >= 110)) roleMatch = true;

                 if (roleMatch) {
                     matchCount += 20;
                 }
             }
         });
     });

    // Check for general types requested
    parsed.types.forEach(type => {
        if (team.pokemons.some(p => p && p.types?.some(t => t.toLowerCase() === type.toLowerCase()))) {
            matchCount += 5; // Low score for general type presence
        }
    });

    // Check for general roles requested (slightly higher score than just type)
     parsed.roles.forEach(role => {
         let roleFound = false;
         team.pokemons.forEach(p => {
             if (p && p.stats) {
                  const stats = p.stats;
                  if ((role === "strong attacker") && stats.attack >= 110) roleFound = true;
                  if ((role === "strong special attacker") && stats['special-attack'] >= 110) roleFound = true;
                  if ((role === "defensive") && stats.defense >= 100) roleFound = true;
                  if ((role === "specially defensive") && stats['special-defense'] >= 100) roleFound = true;
                  if ((role === "speedy") && stats.speed >= 100) roleFound = true;
                  if ((role === "bulky") && stats.hp >= 100) roleFound = true;
                  if ((role === "wall") && (stats.defense >= 110 || stats['special-defense'] >= 110)) roleFound = true;
             }
         });
         if (roleFound) {
             matchCount += 10;
         }
     });


    return matchCount;
}

function generatePokepaste(instruction) {
    // Ensure data is loaded before attempting generation
    if (!data) {
        console.error("Data not loaded yet. Please wait for data initialization.");
        // Return an empty result or handle appropriately
         return [[], true]; // Indicate no detection possible due to missing data
    }

    const parsed = parseInstruction(instruction);
    console.log("Parsed Instruction:", parsed);

    // Calculate match scores for all teams
    const matchScores = data.map((team, index) => {
        try {
            return matchTeam(instruction, team);
        } catch (error) {
            console.error(`Error matching team index ${index} (Filename: ${team?.filename}):`, error);
            return 0; // Assign score 0 if error occurs during matching
        }
    });
    //console.log("Match Scores:", matchScores);

    // Find the maximum match score
    const maxScore = Math.max(0, ...matchScores.filter(score => !isNaN(score) && isFinite(score))); // Ensure maxScore is non-negative and finite

    // Determine if any significant match was found
     // Consider a threshold score instead of just > 0 if needed
    const noDetect = maxScore === 0;

    console.log("Max Score:", maxScore, "No Detect:", noDetect);

    // Find all teams with the maximum match score (and score > 0)
    const bestTeams = data.filter((team, index) => matchScores[index] === maxScore && maxScore > 0);

    // Extract only the required fields for each team
    const simplifiedTeams = bestTeams.map(team => ({
        filename: team.filename || "unknown",
        pokemons: (team.pokemons || []).map(p => {
            // Handle potentially missing pokemon data gracefully
             if (!p) return null; // Skip if pokemon entry is null/undefined

             // Ensure moves is an array, default to empty if not
             const moves = Array.isArray(p.moves) ? p.moves : [];

            return {
                name: p.name || "Unknown Pokemon",
                ability: p.ability || "Unknown Ability",
                item: p.item || "No Item",
                // Process moves, ensuring they are objects with name/type
                moves: moves.slice(0, 4).map(m => {
                    if (typeof m === 'object' && m !== null && m.name) {
                        return {
                            name: m.name,
                            type: m.type || 'unknown' // Provide default type
                        };
                    } else if (typeof m === 'string') {
                         // If it's just a string, create the object structure
                        return {
                            name: m,
                            type: 'unknown' // Type might not be available
                        };
                    }
                     // Handle unexpected move format
                     return { name: 'Unknown Move', type: 'unknown' };
                 }).filter(m => m.name !== 'Unknown Move'), // Filter out unknowns if needed
                tera_type: p.tera_type || "None",
                // Use optional chaining for sprite safety
                sprite: p.sprites?.front_default || null // Default to null if no sprite
            };
         }).filter(p => p !== null) // Remove any null entries from mapping malformed pokemon data
    }));

    return [simplifiedTeams, noDetect];
}

// Expose the generatePokepaste function to the global scope
window.generatePokepaste = generatePokepaste;