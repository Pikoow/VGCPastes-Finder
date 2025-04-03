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
let pokemonNames = new Set(); // Will store normalized names
let pokemonNameMap = new Map(); // Map from lower-case normalized name to original case name

// Define size/weight thresholds (adjust as needed)
const SMALL_THRESHOLD = 5; // Height in decimetres (e.g., <= 0.5m)
const TALL_THRESHOLD = 20; // Height in decimetres (e.g., >= 2.0m)
const LIGHT_THRESHOLD = 100; // Weight in hectograms (e.g., <= 10.0kg)
const HEAVY_THRESHOLD = 2000; // Weight in hectograms (e.g., >= 200.0kg)

// Helper function to normalize Pokémon names (remove gender markers)
function normalizePokemonName(name) {
    if (!name) return name;
    // Remove space + (M/F) or just (M/F) at the end, case-insensitive
    return name.replace(/\s*\([MF]\)$/i, '').trim();
}

async function initializeData() {
    await dataLoaded;
    if (!data) {
        console.error("Data failed to load, cannot initialize.");
        return;
    }
    // Cache all Pokémon names, normalizing them
    data.forEach(team => {
        team.pokemons.forEach(p => {
            if (p && p.name) {
                const originalName = p.name;
                const normalizedName = normalizePokemonName(originalName);
                const lowerNormalizedName = normalizedName.toLowerCase();

                pokemonNames.add(lowerNormalizedName); // Add lower-case normalized name to the set for quick lookup

                // Store mapping from lower-case normalized name to the *first* original case encountered
                // This prefers the base form if both base and gendered forms exist in data
                if (!pokemonNameMap.has(lowerNormalizedName)) {
                    pokemonNameMap.set(lowerNormalizedName, normalizedName); // Store original-case normalized name
                }
                // Also map any potential original gendered name to the original base name
                if (originalName !== normalizedName && !pokemonNameMap.has(originalName.toLowerCase())) {
                     pokemonNameMap.set(originalName.toLowerCase(), normalizedName);
                }

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

    window.pokemonNames = pokemonNames; // Expose the SET of lower-case normalized names
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
        return;
    }
}

// Load data when script runs
loadAllData().catch(console.error);

function parseInstruction(instruction) {
    const parsed = {
        pokemon: [], // Stores original-case *normalized* names
        pokemon_with_items: [],
        pokemon_with_tera: [],
        pokemon_with_abilities: [],
        pokemon_with_moves: [],
        types_with_roles: [],
        types: [],
        roles: [],
        moves: [],
        abilities: [],
        size_requests: [],
        weight_requests: []
    };

    const lowerInstruction = instruction.toLowerCase();
    const pokemonReferences = [];

    // First, find all Pokémon mentions and their positions
    // We iterate through the *known normalized names* from our data
    if (pokemonNames && pokemonNames.size > 0) {
        [...pokemonNames].forEach(lowerNormalizedName => {
            if (!lowerNormalizedName) return; // Skip if name is undefined/null

            // Use word boundaries and exact matching for the normalized Pokémon name
            // Escape hyphens correctly
            const escapedName = lowerNormalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            // Regex now includes optional gender marker: (?:...) is non-capturing group, ? makes it optional
            // \s* matches optional space before (M/F)
            const regex = new RegExp(`(^|\\s)${escapedName}(?:\\s*\\([MF]\\))?(?=$|\\s|'s|-)`, 'gi');
            let match;

            while ((match = regex.exec(lowerInstruction)) !== null) {
                // Get the original case *normalized* name from our map
                const originalCaseNormalizedName = pokemonNameMap.get(lowerNormalizedName) || lowerNormalizedName; // Fallback needed?

                // The actual text matched in the instruction (could include gender marker)
                const matchedText = match[0].trim();
                 // Use the length of the matched text in the instruction for positioning next search
                 const matchEndPosition = match.index + matchedText.length;


                pokemonReferences.push({
                    name: originalCaseNormalizedName, // Store original case *normalized* name
                    position: match.index,
                    endPosition: matchEndPosition, // Store end position of the match in instruction
                    lowerName: lowerNormalizedName // Keep lower case *normalized* name for logic
                });
            }
        });
    }


    // Sort by position to process in order
    pokemonReferences.sort((a, b) => a.position - b.position);

    // Remove duplicates and prefer longer names (like Landorus-Therian over Landorus)
    // This logic should work correctly with normalized names
    const uniquePokemon = [];
    pokemonReferences.forEach(ref => {
         const isSubstring = uniquePokemon.some(p => p.lowerName.includes(ref.lowerName) && p.lowerName !== ref.lowerName);
         const isSuperstring = uniquePokemon.some(p => ref.lowerName.includes(p.lowerName) && p.lowerName !== ref.lowerName);

         if (isSubstring) {
             return;
         } else if (isSuperstring) {
             const indexToRemove = uniquePokemon.findIndex(p => ref.lowerName.includes(p.lowerName));
             if (indexToRemove !== -1) {
                 uniquePokemon.splice(indexToRemove, 1, ref);
             } else {
                  uniquePokemon.push(ref);
             }
         } else if (!uniquePokemon.some(p => p.lowerName === ref.lowerName)) {
             uniquePokemon.push(ref);
         }
    });


    parsed.pokemon = uniquePokemon.map(ref => ref.name); // Store original case *normalized* names

    // Process each Pokémon reference for items, moves, abilities
    for (let i = 0; i < uniquePokemon.length; i++) {
        const currentPokemon = uniquePokemon[i];
        const nextPokemon = i < uniquePokemon.length - 1 ? uniquePokemon[i + 1] : null;

        // Extract the text relevant to this Pokémon using its end position
        const start = currentPokemon.endPosition; // Start search *after* the matched pokemon name (including potential gender marker)
        const end = nextPokemon ? nextPokemon.position : lowerInstruction.length;
        const pokemonText = lowerInstruction.slice(start, end).trim();

        // Look for "with" or "holding" clauses
        const withMatch = pokemonText.match(/\b(?:with|holding)\b/);
        if (withMatch) {
            const afterWith = pokemonText.slice(withMatch.index + withMatch[0].length).trim();
            const itemsAndDetails = afterWith.split(/\s*,\s*|\s+\band\b\s+(?!\w+[-']?\w+\s)/)
                                            .map(p => p.trim())
                                            .filter(p => p);

            // **MODIFIED LOGIC START**
            for (const part of itemsAndDetails) {
                let itemFoundInPart = false;
                let abilityFoundInPart = false;

                // 1. Check for items FIRST
                for (const item of allItems) {
                    if (item && new RegExp(`(^|\\s)${item.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part)) {
                        parsed.pokemon_with_items.push({
                            pokemon: currentPokemon.name, // Use original case *normalized* name
                            item: item
                        });
                        itemFoundInPart = true;
                        break; // Found the item for this part, stop checking other items
                    }
                }

                // If an item was found for THIS specific part, skip ability/move checks FOR THIS PART
                if (itemFoundInPart) {
                    continue; // Move to the next 'part' in itemsAndDetails
                }

                // 2. Check for abilities ONLY if no item was found in this part
                for (const ability of allAbilities) {
                    if (ability &&
                        new RegExp(`(^|\\s)${ability.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part) &&
                        !uniquePokemon.some(p => p.lowerName.includes(ability))) { // Keep the check to avoid matching Pokémon names
                       parsed.pokemon_with_abilities.push({
                           pokemon: currentPokemon.name, // Use original case *normalized* name
                           ability: ability
                       });
                       abilityFoundInPart = true;
                       break; // Found the ability for this part, stop checking other abilities
                   }
                }

                // If an ability was found for THIS specific part, skip move checks FOR THIS PART
                if (abilityFoundInPart) {
                    continue; // Move to the next 'part' in itemsAndDetails
                }

                // 3. Check for moves ONLY if no item OR ability was found in this part
                for (const move of allMoves) {
                    if (move &&
                        new RegExp(`(^|\\s)${move.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(part) &&
                        !uniquePokemon.some(p => p.lowerName.includes(move))) { // Keep the check to avoid matching Pokémon names
                       parsed.pokemon_with_moves.push({
                           pokemon: currentPokemon.name, // Use original case *normalized* name
                           move: move
                       });
                       // Don't break here; allow multiple moves from the same part if specified (e.g., "with move1 and move2")
                   }
                }
            } // End loop for 'part'
             // **MODIFIED LOGIC END**
        }

         // --- Check Tera Type specifically linked to this Pokemon mention ---
         const teraTypes = ["steel", "fighting", "dragon", "water", "electric", "fairy", "fire", "ice", "bug", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"];
         teraTypes.forEach(tera => {
             // Look for "tera [type]" immediately after the pokemon name (or gender marker)
             const teraRegex = new RegExp(`^\\s+tera\\s+${tera}\\b`, 'i'); // Check beginning of pokemonText
             if (teraRegex.test(pokemonText)) {
                  // Check if this pokemon+tera combo already added (less likely here, but good practice)
                  if (!parsed.pokemon_with_tera.some(pt => pt.pokemon === currentPokemon.name && pt.tera_type === tera)) {
                      parsed.pokemon_with_tera.push({
                           pokemon: currentPokemon.name, // Use original case *normalized* name
                           tera_type: tera
                      });
                  }
                  // Optimization: Once a tera type is found for this pokemon in this block, can maybe stop checking others? Depends on phrasing allowance.
             }
         });
    }

    // --- General Tera type parsing (might catch cases missed above or general requests) ---
    // Moved this outside the loop to catch general patterns like "Gholdengo tera steel" anywhere
    const teraTypes = ["steel", "fighting", "dragon", "water", "electric", "fairy", "fire", "ice", "bug", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"];
    teraTypes.forEach(tera => {
         // Regex to find "[pokemon name possibly with gender] tera [type]" pattern anywhere
         // Use uniquePokemon.map(p => p.lowerName) for the list of *normalized* pokemon names
         const pokeNamePattern = uniquePokemon.map(p => p.lowerName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
         if (!pokeNamePattern) return; // Skip if no pokemon were found

         const teraRegex = new RegExp(`\\b(${pokeNamePattern})(?:\\s*\\([MF]\\))?\\s+tera\\s+${tera}\\b`, 'gi');
         let teraMatch;
         while ((teraMatch = teraRegex.exec(lowerInstruction)) !== null) {
            const pokemonNameLowerNormalized = teraMatch[1];
            // Find the original case *normalized* name matching the lower case name found
            const originalPokemon = uniquePokemon.find(p => p.lowerName === pokemonNameLowerNormalized);
             if (originalPokemon) {
                 // Add only if this specific combination hasn't been added yet
                 if (!parsed.pokemon_with_tera.some(pt => pt.pokemon === originalPokemon.name && pt.tera_type === tera)) {
                     parsed.pokemon_with_tera.push({
                          pokemon: originalPokemon.name, // Use original case *normalized* name
                          tera_type: tera
                     });
                 }
            }
         }
    });


     // --- Size and Weight Requests ---
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

    // --- General Moves/Abilities/Types/Roles (No major changes needed here) ---
    // Detect specific moves (general request) - avoid matching if it was already part of a pokemon-specific request
    allMoves.forEach(move => {
        if (move &&
            new RegExp(`(^|\\s)${move.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(lowerInstruction) &&
            !parsed.pokemon_with_moves.some(pm => pm.move === move) && // Ensure not already linked to a specific Pokemon
            !uniquePokemon.some(p => p.lowerName.includes(move))) {
            parsed.moves.push(move);
        }
    });

    // Detect specific abilities (general request) - avoid matching if it was already part of a pokemon-specific request
    [...allAbilities].forEach(ability => {
        if (ability &&
            new RegExp(`(^|\\s)${ability.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=$|\\s)`, 'i').test(lowerInstruction) &&
            !parsed.pokemon_with_abilities.some(pa => pa.ability === ability) && // Ensure not already linked to a specific Pokemon
            !uniquePokemon.some(p => p.lowerName.includes(ability))) {
            parsed.abilities.push(ability);
        }
    });

    // Detect Types with specific roles
    const roles = {
        "strong attacker": ["strong attacker", "physical attacker", "attacker"],
        "strong special attacker": ["strong special attacker", "special attacker"],
        "defensive": ["defensive", "physically defensive"],
        "specially defensive": ["specially defensive", "special defense"],
        "speedy": ["speedy", "fast"],
        "bulky": ["bulky", "hp"],
        "wall": ["wall", "tank"]
    };
     Object.entries(roles).forEach(([role, keywords]) => {
         if (keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(lowerInstruction))) {
             if(!parsed.roles.includes(role)) parsed.roles.push(role); // Add general role if found

             teraTypes.forEach(type => {
                  if (new RegExp(`\\b${type}(?:-type)?\\b.*\\b(${keywords.join('|')})\\b|\\b(${keywords.join('|')})\\b.*\\b${type}(?:-type)?\\b`, 'i').test(lowerInstruction)) {
                     if (!parsed.types_with_roles.some(tr => tr.type === type && tr.role === role)) {
                          parsed.types_with_roles.push({ type, role });
                     }
                 }
              });
         }
     });

    // Detect general type mentions
    teraTypes.forEach(type => {
         if (new RegExp(`\\b${type}(?:-type)?\\b`, 'i').test(lowerInstruction)) {
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

     if (!team || !team.pokemons || team.pokemons.length === 0) return 0;

    // --- Normalize team pokemon names for comparison ---
    const teamPokemonsNormalized = team.pokemons.map(p => {
        if (!p) return null;
        return {
            ...p, // Keep original data
            normalizedName: normalizePokemonName(p.name || ""), // Add normalized name
            lowerNormalizedName: normalizePokemonName(p.name || "").toLowerCase() // Add lower-case normalized name
        };
    }).filter(p => p !== null); // Filter out any null entries if original pokemon was null


    // Check for Pokémon in the instruction (comparing normalized names)
    parsed.pokemon.forEach(requestedPokemonName => {
         // requestedPokemonName is already normalized original case from parseInstruction
         const lowerRequested = requestedPokemonName.toLowerCase();
         // Compare lower requested normalized name with lower normalized names in team
        if (teamPokemonsNormalized.some(p => p.lowerNormalizedName === lowerRequested)) {
            matchCount += 100;
        }
    });

    // Check for Pokémon with specific items (compare normalized names)
    parsed.pokemon_with_items.forEach(pokemonItem => {
        const lowerRequestedPokemon = pokemonItem.pokemon.toLowerCase(); // Lowercase normalized requested name
        teamPokemonsNormalized.forEach(p => {
            if (p.lowerNormalizedName === lowerRequestedPokemon && p.item?.toLowerCase() === pokemonItem.item) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific Tera types (compare normalized names)
    parsed.pokemon_with_tera.forEach(pokemonTera => {
        const lowerRequestedPokemon = pokemonTera.pokemon.toLowerCase();
        teamPokemonsNormalized.forEach(p => {
             if (p.lowerNormalizedName === lowerRequestedPokemon && p.tera_type?.toLowerCase() === pokemonTera.tera_type) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific abilities (compare normalized names)
    parsed.pokemon_with_abilities.forEach(pokemonAbility => {
         const lowerRequestedPokemon = pokemonAbility.pokemon.toLowerCase();
        teamPokemonsNormalized.forEach(p => {
             if (p.lowerNormalizedName === lowerRequestedPokemon && p.ability?.toLowerCase() === pokemonAbility.ability) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific moves (compare normalized names)
    parsed.pokemon_with_moves.forEach(pokemonMove => {
        const lowerRequestedPokemon = pokemonMove.pokemon.toLowerCase();
        teamPokemonsNormalized.forEach(p => {
             if (p.lowerNormalizedName === lowerRequestedPokemon) {
                 const hasMove = p.moves?.some(m => {
                     const moveName = (typeof m === 'object' && m !== null ? m.name : m)?.toLowerCase();
                     return moveName === pokemonMove.move;
                 });
                 if (hasMove) {
                     matchCount += 25;
                 }
            }
        });
    });

     // --- Size and Weight Requests (No changes needed here) ---
     parsed.size_requests.forEach(req => {
         let count = 0;
         teamPokemonsNormalized.forEach(p => { /* ... size check logic ... */
            if (p && p.height !== null && p.height !== undefined) {
                 if (req.type === 'small' && p.height <= SMALL_THRESHOLD) count++;
                 else if (req.type === 'tall' && p.height >= TALL_THRESHOLD) count++;
            }
         });
         if (count >= req.count) matchCount += 40;
     });
     parsed.weight_requests.forEach(req => {
        let count = 0;
        teamPokemonsNormalized.forEach(p => { /* ... weight check logic ... */
            if (p && p.weight !== null && p.weight !== undefined) {
                if (req.type === 'light' && p.weight <= LIGHT_THRESHOLD) count++;
                else if (req.type === 'heavy' && p.weight >= HEAVY_THRESHOLD) count++;
            }
        });
        if (count >= req.count) matchCount += 40;
    });

    // --- General Moves/Abilities/Types/Roles (No changes needed here) ---
    // Check for specific moves generally in the team
    parsed.moves.forEach(move => {
         const hasMove = teamPokemonsNormalized.some(p => /* ... move check logic ... */
             p && p.moves?.some(m => {
                 const moveName = (typeof m === 'object' && m !== null ? m.name : m)?.toLowerCase();
                 return moveName === move;
             })
         );
         if (hasMove) matchCount += 15;
    });
    // Check for specific abilities generally in the team
     parsed.abilities.forEach(ability => {
         const hasAbility = teamPokemonsNormalized.some(p => p && p.ability?.toLowerCase() === ability);
         if (hasAbility) matchCount += 15;
     });
    // Check for Types with specific roles
    parsed.types_with_roles.forEach(typeRole => {
         teamPokemonsNormalized.forEach(p => { /* ... type/role check logic ... */
            if (p && p.types?.some(type => type.toLowerCase() === typeRole.type.toLowerCase())) {
                const stats = p.stats || {}; let roleMatch = false;
                const roleKeywords = { // Define keywords for roles
                    "strong attacker": ["strong attacker", "physical attacker", "attacker"],
                    "strong special attacker": ["strong special attacker", "special attacker"],
                    "defensive": ["defensive", "physically defensive"],
                    "specially defensive": ["specially defensive", "special defense"],
                    "speedy": ["speedy", "fast"],
                    "bulky": ["bulky", "hp"],
                    "wall": ["wall", "tank"]
                };
                // Check if the requested role matches the Pokemon's stats
                 if ((typeRole.role === "strong attacker") && (stats.attack || 0) >= 110) roleMatch = true;
                 if ((typeRole.role === "strong special attacker") && (stats['special-attack'] || 0) >= 110) roleMatch = true;
                 if ((typeRole.role === "defensive") && (stats.defense || 0) >= 100) roleMatch = true;
                 if ((typeRole.role === "specially defensive") && (stats['special-defense'] || 0) >= 100) roleMatch = true;
                 if ((typeRole.role === "speedy") && (stats.speed || 0) >= 100) roleMatch = true;
                 if ((typeRole.role === "bulky") && (stats.hp || 0) >= 100) roleMatch = true;
                 if ((typeRole.role === "wall") && ((stats.defense || 0) >= 110 || (stats['special-defense'] || 0) >= 110)) roleMatch = true;
                 if (roleMatch) matchCount += 20;
             }
         });
     });
    // Check for general types requested
    parsed.types.forEach(type => {
        if (teamPokemonsNormalized.some(p => p && p.types?.some(t => t.toLowerCase() === type.toLowerCase()))) {
            matchCount += 5;
        }
    });
    // Check for general roles requested
     parsed.roles.forEach(role => {
         let roleFound = false;
         teamPokemonsNormalized.forEach(p => { /* ... role check logic ... */
            if (p && p.stats) {
                const stats = p.stats;
                if ((role === "strong attacker") && (stats.attack || 0) >= 110) roleFound = true;
                if ((role === "strong special attacker") && (stats['special-attack'] || 0) >= 110) roleFound = true;
                if ((role === "defensive") && (stats.defense || 0) >= 100) roleFound = true;
                if ((role === "specially defensive") && (stats['special-defense'] || 0) >= 100) roleFound = true;
                if ((role === "speedy") && (stats.speed || 0) >= 100) roleFound = true;
                if ((role === "bulky") && (stats.hp || 0) >= 100) roleFound = true;
                if ((role === "wall") && ((stats.defense || 0) >= 110 || (stats['special-defense'] || 0) >= 110)) roleFound = true;
            }
         });
         if (roleFound) matchCount += 10;
     });

    return matchCount;
}

function generatePokepaste(instruction) {
    if (!data) {
        console.error("Data not loaded yet.");
         return [[], true];
    }

    const parsed = parseInstruction(instruction);
    console.log("Parsed Instruction:", parsed);

    // Calculate match scores for all teams
    const scoredTeams = data.map((team, index) => {
        try {
            const score = matchTeam(instruction, team);
            return { ...team, score, originalIndex: index }; // Add score and original index
        } catch (error) {
            console.error(`Error matching team index ${index} (Filename: ${team?.filename}):`, error);
            return { ...team, score: 0, originalIndex: index }; // Assign score 0 if error occurs
        }
    });

    // Sort teams by score in descending order
    scoredTeams.sort((a, b) => b.score - a.score);

    // Filter out teams with score 0 unless no teams have score > 0
    const maxScore = scoredTeams.length > 0 ? scoredTeams[0].score : 0;
    const highestScoringTeams = scoredTeams.filter(team => team.score === maxScore);

    const noDetect = maxScore === 0; // No detection if the highest score is 0

    console.log("Max Score:", maxScore, "No Detect:", noDetect);
    console.log("Highest Scoring Teams Found:", highestScoringTeams.length);

    // Extract only the required fields for each relevant team
    const simplifiedTeams = highestScoringTeams.map(team => ({
        filename: team.filename || "unknown",
        score: team.score, // Keep score for potential display/debugging
        pokemons: (team.pokemons || []).map(p => {
             if (!p) return null;
             const moves = Array.isArray(p.moves) ? p.moves : [];
             // IMPORTANT: Use the ORIGINAL name from the data for display, not the normalized one
             return {
                name: p.name || "Unknown Pokemon", // Use original name here
                ability: p.ability || "Unknown Ability",
                item: p.item || "No Item",
                moves: moves.slice(0, 4).map(m => {
                    if (typeof m === 'object' && m !== null && m.name) {
                        return { name: m.name, type: m.type || 'unknown' };
                    } else if (typeof m === 'string') {
                        return { name: m, type: 'unknown' };
                    }
                     return { name: 'Unknown Move', type: 'unknown' };
                 }).filter(m => m.name !== 'Unknown Move'),
                tera_type: p.tera_type || "None",
                sprite: p.sprites?.front_default || null
            };
         }).filter(p => p !== null)
    }));

    // If no teams had score > 0, and we have teams, maybe return the top one as 'random'/'fallback'
    if (noDetect && simplifiedTeams.length === 0 && scoredTeams.length > 0) {
         console.log("No positive match, returning first team as fallback.");
         const fallbackTeam = scoredTeams[0];
         const simplifiedFallback = {
            filename: fallbackTeam.filename || "unknown",
            score: fallbackTeam.score,
             pokemons: (fallbackTeam.pokemons || []).map(p => {
                 if (!p) return null;
                 const moves = Array.isArray(p.moves) ? p.moves : [];
                 return {
                     name: p.name || "Unknown Pokemon", // Original name
                     ability: p.ability || "Unknown Ability",
                     item: p.item || "No Item",
                     moves: moves.slice(0, 4).map(m => {
                        if (typeof m === 'object' && m !== null && m.name) {
                            return { name: m.name, type: m.type || 'unknown' };
                        } else if (typeof m === 'string') {
                            return { name: m, type: 'unknown' };
                        }
                        return { name: 'Unknown Move', type: 'unknown' };
                     }).filter(m => m.name !== 'Unknown Move'),
                     tera_type: p.tera_type || "None",
                     sprite: p.sprites?.front_default || null
                 };
             }).filter(p => p !== null)
         };
         return [[simplifiedFallback], true]; // Return the single fallback team, indicate noDetect
    }


    return [simplifiedTeams, noDetect];
}

// Expose the generatePokepaste function to the global scope
window.generatePokepaste = generatePokepaste;