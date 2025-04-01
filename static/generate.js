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

async function initializeData() {
    await dataLoaded;
    
    // Cache all Pokémon names
    data.forEach(team => {
        team.pokemons.forEach(p => {
            pokemonNames.add(p.name.toLowerCase());
            if (p.ability) allAbilities.add(p.ability.toLowerCase());
        });
    });
    
    // Pre-process moves from existing data
    data.forEach(team => {
        team.pokemons.forEach(p => {
            p.moves.forEach(move => {
                const moveName = (typeof move === 'object' ? move.name : move).toLowerCase();
                allMoves.push(moveName);
            });
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
        const items = text.match(/exports\.BattleItems = ({.*?});/s)?.[1] || '{}';
        allItems = items.match(/name:"([^"]+)"/g)?.map(name => name.slice(6, -1).toLowerCase()) || [];
        return allItems;
    } catch (error) {
        console.error('Error fetching items:', error);
        return [];
    }
}

async function fetchAllMoves() {
    if (allMoves.length > 0) return allMoves; // Return cached moves
    
    const url = "https://play.pokemonshowdown.com/data/moves.js";
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.status}`);
        
        const text = await response.text();
        const moves = text.match(/exports\.BattleMovedex = ({.*?});/s)?.[1] || '{}';
        allMoves = moves.match(/name:"([^"]+)"/g)?.map(name => name.slice(6, -1).toLowerCase()) || [];
        return allMoves;
    } catch (error) {
        console.error('Error fetching moves:', error);
        return [];
    }
}

async function loadAllData() {
    await Promise.all([fetchAllItems(), fetchAllMoves()]);
    await initializeData();
    
    // Now you can safely use pokemonNames and allAbilities
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
        team_composition: []
    };

    const lowerInstruction = instruction.toLowerCase();
    const pokemonReferences = [];

    // First, find all Pokémon mentions and their positions
    [...pokemonNames].forEach(name => {
        // Use word boundaries and exact matching for Pokémon names
        const regex = new RegExp(`(^|\\s)${name.replace(/[-]/g, '\\-')}(?=$|\\s)`, 'g');
        let match;
        while ((match = regex.exec(lowerInstruction)) !== null) {
            pokemonReferences.push({
                name: data[0].pokemons.find(p => p.name.toLowerCase() === name)?.name || name,
                position: match.index,
                lowerName: name
            });
        }
    });

    // Sort by position to process in order
    pokemonReferences.sort((a, b) => a.position - b.position);

    // Remove duplicates and prefer longer names (like Landorus-Therian over Landorus)
    const uniquePokemon = [];
    pokemonReferences.forEach(ref => {
        const existing = uniquePokemon.find(p => 
            p.lowerName.includes(ref.lowerName) || ref.lowerName.includes(p.lowerName)
        );
        if (!existing) {
            uniquePokemon.push(ref);
        } else if (ref.lowerName.length > existing.lowerName.length) {
            // Replace with the longer name
            const index = uniquePokemon.indexOf(existing);
            uniquePokemon[index] = ref;
        }
    });

    parsed.pokemon = pokemonReferences.map(ref => ref.name);

    // Process each Pokémon reference
    for (let i = 0; i < uniquePokemon.length; i++) {
        const currentPokemon = uniquePokemon[i];
        const nextPokemon = i < uniquePokemon.length - 1 ? uniquePokemon[i + 1] : null;
        
        // Extract the text relevant to this Pokémon (from current position to next Pokémon or end)
        const start = currentPokemon.position + currentPokemon.lowerName.length;
        const end = nextPokemon ? nextPokemon.position : lowerInstruction.length;
        const pokemonText = lowerInstruction.slice(start, end).trim();

        // Look for "with" or "holding" clauses
        const withMatch = pokemonText.match(/\bwith\b|\bholding\b/);
        if (withMatch) {
            const afterWith = pokemonText.slice(withMatch.index + withMatch[0].length).trim();
            
            // Split by commas or "and" but be careful with "and" in move names (like "Double-Edge")
            const itemsAndMoves = afterWith.split(/(?:,\s*|\band\b)(?![^(]*\))/); // Negative lookahead for parentheses
            
            for (const part of itemsAndMoves.map(p => p.trim()).filter(p => p)) {
                // Check for items
                for (const item of allItems) {
                    if (item && new RegExp(`(^|\\s)${item}(?=$|\\s)`).test(part)) {
                        parsed.pokemon_with_items.push({
                            pokemon: currentPokemon.name,
                            item
                        });
                    }
                }
                
                // Check for moves - only if they're not part of a Pokémon name
                for (const move of allMoves) {
                    if (move && 
                        new RegExp(`(^|\\s)${move}(?=$|\\s)`).test(part) &&
                        !uniquePokemon.some(p => p.lowerName.includes(move))) {
                        parsed.pokemon_with_moves.push({
                            pokemon: currentPokemon.name,
                            move
                        });
                    }
                }
                
                // Check for abilities - only if they're not part of a Pokémon name
                for (const ability of allAbilities) {
                    if (ability && 
                        new RegExp(`(^|\\s)${ability}(?=$|\\s)`).test(part) &&
                        !uniquePokemon.some(p => p.lowerName.includes(ability))) {
                        parsed.pokemon_with_abilities.push({
                            pokemon: currentPokemon.name,
                            ability
                        });
                    }
                }
            }
        }
    }

    // Detect Pokémon with specific Tera types
    const teraTypes = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"];
    teraTypes.forEach(tera => {
        if (lowerInstruction.includes(`tera ${tera}`)) {
            parsed.pokemon.forEach(pokemon => {
                if (lowerInstruction.includes(`${pokemon.toLowerCase()} tera ${tera}`)) {
                    parsed.pokemon_with_tera.push({ pokemon, tera_type: tera });
                }
            });
        }
    });

    // Detect specific moves (additional checks beyond the "with" clause)
    allMoves.forEach(move => {
        if (move && 
            new RegExp(`(^|\\s)${move}(?=$|\\s)`).test(lowerInstruction) && 
            !parsed.pokemon_with_moves.some(m => m.move === move) &&
            !uniquePokemon.some(p => p.lowerName.includes(move))) {
            parsed.moves.push(move);
        }
    });

    // Detect abilities (additional checks beyond the "with" clause)
    [...allAbilities].forEach(ability => {
        if (ability && 
            new RegExp(`(^|\\s)${ability}(?=$|\\s)`).test(lowerInstruction) && 
            !parsed.pokemon_with_abilities.some(a => a.ability === ability) &&
            !uniquePokemon.some(p => p.lowerName.includes(ability))) {
            parsed.abilities.push(ability);
        }
    });

    // Detect Types with specific roles
    const roles = {
        "strong attacker": ["attack", "physical attacker"],
        "strong special attacker": ["special attack", "special attacker"],
        "defensive": ["defense", "defensive"],
        "specially defensive": ["special defense", "specially defensive"],
        "speedy": ["speed", "speedy"]
    };
    Object.entries(roles).forEach(([role, keywords]) => {
        if (keywords.some(keyword => lowerInstruction.includes(keyword))) {
            parsed.roles.push(role);
            
            teraTypes.forEach(type => {
                if (new RegExp(`\\b${type}\\b.*\\b${keywords[0]}\\b|\\b${keywords[0]}\\b.*\\b${type}\\b`).test(lowerInstruction)) {
                    parsed.types_with_roles.push({ type, role });
                }
            });
        }
    });

    // Detect types
    const types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark"];
    types.forEach(type => {
        if (instruction.toLowerCase().includes(`${type.toLowerCase()} type`) || 
            instruction.toLowerCase().includes(`${type.toLowerCase()}-type`)) {
            parsed.types.push(type);
        }
    });

    // Detect team composition features
    const teamFeatures = {
        "rain team": ["rain", "rain team"],
        "sun team": ["sun", "sun team"],
        "sand team": ["sand", "sand team"],
        "hail team": ["hail", "snow", "hail team"],
        "trick room": ["trick room", "slow team"],
        "hyper offense": ["hyper offense", "ho"],
        "balance": ["balanced", "balance"],
        "stall": ["stall", "defensive"]
    };

    Object.entries(teamFeatures).forEach(([feature, keywords]) => {
        if (keywords.some(keyword => lowerInstruction.includes(keyword))) {
            parsed.team_composition.push(feature);
        }
    });

    return parsed;
}

function matchTeam(instruction, team) {
    const parsed = parseInstruction(instruction);
    let matchCount = 0;

    // Check for Pokémon in the instruction
    team.pokemons.forEach(p => {
        if (parsed.pokemon.map(name => name.toLowerCase()).includes(p.name.toLowerCase())) {
            matchCount += 100;
        }
    });

    // Check for Pokémon with specific items
    parsed.pokemon_with_items.forEach(pokemonItem => {
        team.pokemons.forEach(p => {
            if (p.name.toLowerCase() === pokemonItem.pokemon.toLowerCase() && p.item?.toLowerCase() === pokemonItem.item.toLowerCase()) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific Tera types
    parsed.pokemon_with_tera.forEach(pokemonTera => {
        team.pokemons.forEach(p => {
            if (p.name.toLowerCase() === pokemonTera.pokemon.toLowerCase() && p.tera_type?.toLowerCase() === pokemonTera.tera_type.toLowerCase()) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific abilities
    parsed.pokemon_with_abilities.forEach(pokemonAbility => {
        team.pokemons.forEach(p => {
            if (p.name.toLowerCase() === pokemonAbility.pokemon.toLowerCase() && p.ability?.toLowerCase() === pokemonAbility.ability.toLowerCase()) {
                matchCount += 50;
            }
        });
    });

    // Check for Pokémon with specific moves
    parsed.pokemon_with_moves.forEach(pokemonMove => {
        team.pokemons.forEach(p => {
            if (p.name.toLowerCase() === pokemonMove.pokemon.toLowerCase()) {
                const hasMove = p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === pokemonMove.move.toLowerCase();
                });
                if (hasMove) {
                    matchCount += 25;
                }
            }
        });
    });

    // Check for specific moves in the team
    parsed.moves.forEach(move => {
        const hasMove = team.pokemons.some(p => 
            p.moves.some(m => {
                const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                return moveName === move.toLowerCase();
            })
        );
        if (hasMove) {
            matchCount += 15;
        }
    });

    // Check for Pokémon with specific roles
    parsed.types_with_roles.forEach(typeRole => {
        team.pokemons.forEach(p => {
            if (p.types?.some(type => type.toLowerCase() === typeRole.type.toLowerCase())) {
                const stats = p.stats || {};
                if (typeRole.role === "strong attacker" && stats.attack >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "strong special attacker" && stats["special-attack"] >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "defensive" && stats.defense >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "specially defensive" && stats["special-defense"] >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "speedy" && stats.speed >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "bulky" && stats.hp >= 100) {
                    matchCount += 20;
                }
                if (typeRole.role === "wall" && (stats.defense >= 100 || stats["special-defense"] >= 100)) {
                    matchCount += 20;
                }
            }
        });
    });

    // Check for types in the instruction
    team.pokemons.forEach(p => {
        if (p.types?.some(type => parsed.types.map(t => t.toLowerCase()).includes(type.toLowerCase()))) {
            matchCount += 5;
        }
    });

    // Check for abilities in the instruction
    parsed.abilities.forEach(ability => {
        const hasAbility = team.pokemons.some(p => p.ability?.toLowerCase() === ability.toLowerCase());
        if (hasAbility) {
            matchCount += 15;
        }
    });

    // Check for team composition features
    parsed.team_composition.forEach(feature => {
        // Rain team check
        if (feature === "rain team") {
            const hasRainSetter = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "drizzle" || 
                p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === "rain dance";
                })
            );
            const hasRainAbusers = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "swift swim" ||
                p.types.includes("water")
            );
            if (hasRainSetter && hasRainAbusers) {
                matchCount += 30;
            } else if (hasRainSetter || hasRainAbusers) {
                matchCount += 15;
            }
        }
        
        // Sun team check
        if (feature === "sun team") {
            const hasSunSetter = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "drought" || 
                p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === "sunny day";
                })
            );
            const hasSunAbusers = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "chlorophyll" ||
                p.types.includes("fire")
            );
            if (hasSunSetter && hasSunAbusers) {
                matchCount += 30;
            } else if (hasSunSetter || hasSunAbusers) {
                matchCount += 15;
            }
        }
        
        // Sand team check
        if (feature === "sand team") {
            const hasSandSetter = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "sand stream" || 
                p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === "sandstorm";
                })
            );
            const hasSandAbusers = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "sand rush" ||
                p.ability?.toLowerCase() === "sand veil" ||
                p.types.includes("rock") ||
                p.types.includes("ground") ||
                p.types.includes("steel")
            );
            if (hasSandSetter && hasSandAbusers) {
                matchCount += 30;
            } else if (hasSandSetter || hasSandAbusers) {
                matchCount += 15;
            }
        }
        
        // Hail team check
        if (feature === "hail team") {
            const hasHailSetter = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "snow warning" || 
                p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === "hail";
                })
            );
            const hasHailAbusers = team.pokemons.some(p => 
                p.ability?.toLowerCase() === "slush rush" ||
                p.types.includes("ice")
            );
            if (hasHailSetter && hasHailAbusers) {
                matchCount += 30;
            } else if (hasHailSetter || hasHailAbusers) {
                matchCount += 15;
            }
        }
        
        // Trick Room check
        if (feature === "trick room") {
            const hasTrickRoom = team.pokemons.some(p => 
                p.moves.some(m => {
                    const moveName = typeof m === 'object' ? m.name.toLowerCase() : m.toLowerCase();
                    return moveName === "trick room";
                })
            );
            const hasSlowPokemon = team.pokemons.some(p => 
                (p.stats?.speed || 0) <= 50
            );
            if (hasTrickRoom && hasSlowPokemon) {
                matchCount += 30;
            } else if (hasTrickRoom || hasSlowPokemon) {
                matchCount += 15;
            }
        }
        
        // Hyper offense check
        if (feature === "hyper offense") {
            const offensivePokemonCount = team.pokemons.filter(p => {
                const stats = p.stats || {};
                return (stats.attack >= 100 || stats["special-attack"] >= 100) && 
                       (stats.speed >= 90);
            }).length;
            if (offensivePokemonCount >= 4) {
                matchCount += 30;
            } else if (offensivePokemonCount >= 2) {
                matchCount += 15;
            }
        }
        
        // Stall check
        if (feature === "stall") {
            const defensivePokemonCount = team.pokemons.filter(p => {
                const stats = p.stats || {};
                return (stats.defense >= 100 || stats["special-defense"] >= 100) && 
                       (stats.hp >= 90);
            }).length;
            if (defensivePokemonCount >= 4) {
                matchCount += 30;
            } else if (defensivePokemonCount >= 2) {
                matchCount += 15;
            }
        }
    });

    return matchCount;
}

function generatePokepaste(instruction) {
    const parsed = parseInstruction(instruction);
    console.log(parsed);

    // Calculate match scores for all teams
    const matchScores = data.map(team => matchTeam(instruction, team));

    // Find the maximum match score
    const maxScore = Math.max(...matchScores);

    const noDetect = maxScore == 0;

    // Find all teams with the maximum match score
    const bestTeams = data.filter((team, index) => matchScores[index] === maxScore);

    // Extract only the required fields for each team
    const simplifiedTeams = bestTeams.map(team => ({
        filename: team.filename || "unknown",
        pokemons: team.pokemons.map(p => ({
            name: p.name,
            ability: p.ability,
            item: p.item,
            moves: p.moves.slice(0, 4).map(m => {
                if (typeof m === 'object') {
                    return {
                        name: m.name,
                        type: m.type
                    };
                }
                return {
                    name: m,
                    type: 'unknown'
                };
            }),
            tera_type: p.tera_type,
            sprite: p.sprites?.front_default
        }))
    }));

    return [simplifiedTeams, noDetect];
}

// Expose the generatePokepaste function to the global scope
window.generatePokepaste = generatePokepaste;