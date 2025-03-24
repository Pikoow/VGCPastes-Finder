// Load processed data
let data;
fetch('https://pikoow.github.io/VGCPastes-Finder/data/processed_data.json')
    .then(response => response.json())
    .then(jsonData => {
        data = jsonData;
    })
    .catch(error => console.error('Error loading processed data:', error));

// Fetch all items from Showdown
async function fetchAllItems() {
    const url = "https://play.pokemonshowdown.com/data/items.js";
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.status}`);
        }
        const text = await response.text();
        const match = text.match(/exports\.BattleItems = ({.*?});/s);
        if (!match) {
            throw new Error("Could not find the BattleItems object in the JavaScript file.");
        }
        const items = match[1];
        const names = items.match(/name:"([^"]+)"/g).map(name => name.slice(6, -1));
        return names;
    } catch (error) {
        console.error('Error fetching items:', error);
        return [];
    }
}

let allItems = [];
fetchAllItems().then(items => allItems = items);

function parseInstruction(instruction) {
    const parsed = {
        pokemon: [],
        pokemon_with_items: [],
        pokemon_with_tera: [],
        pokemon_with_roles: [],
        types: [],
        roles: []
    };

    // Detect Pokémon names
    data.forEach(team => {
        team.pokemons.forEach(p => {
            if (instruction.toLowerCase().includes(p.name.toLowerCase()) && !parsed.pokemon.includes(p.name)) {
                parsed.pokemon.push(p.name);
            }
        });
    });

    // Detect Pokémon with specific items
    parsed.pokemon.forEach(pokemon => {
        allItems.forEach(item => {
            if (instruction.toLowerCase().includes(`${pokemon.toLowerCase()} with ${item.toLowerCase()}`) ||
                instruction.toLowerCase().includes(`${pokemon.toLowerCase()} holding ${item.toLowerCase()}`) ||
                instruction.toLowerCase().includes(`${pokemon.toLowerCase()} with a ${item.toLowerCase()}`) ||
                instruction.toLowerCase().includes(`${pokemon.toLowerCase()} holding a ${item.toLowerCase()}`)) {
                parsed.pokemon_with_items.push({ pokemon, item });
            }
        });
    });

    // Detect Pokémon with specific Tera types
    const teraTypes = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"];
    parsed.pokemon.forEach(pokemon => {
        teraTypes.forEach(tera => {
            if (instruction.toLowerCase().includes(`tera ${tera.toLowerCase()} ${pokemon.toLowerCase()}`)) {
                parsed.pokemon_with_tera.push({ pokemon, tera_type: tera });
            }
        });
    });

    // Detect Pokémon with specific roles
    const roles = {
        "strong attacker": ["attack", "physical attacker"],
        "strong special attacker": ["special attack", "special attacker"],
        "defensive": ["defense", "defensive"],
        "specially defensive": ["special defense", "specially defensive"],
        "speedy": ["speed", "speedy"]
    };
    Object.entries(roles).forEach(([role, keywords]) => {
        if (keywords.some(keyword => instruction.toLowerCase().includes(keyword))) {
            parsed.roles.push(role);
            parsed.pokemon.forEach(pokemon => {
                if (instruction.toLowerCase().includes(pokemon.toLowerCase())) {
                    parsed.pokemon_with_roles.push({ pokemon, role });
                }
            });
        }
    });

    // Detect types
    const types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark"];
    types.forEach(type => {
        if (instruction.toLowerCase().includes(`${type.toLowerCase()} type`) || instruction.toLowerCase().includes(`${type.toLowerCase()}-type`)) {
            parsed.types.push(type);
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
            matchCount += 10;
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
                matchCount += 30;
            }
        });
    });

    // Check for Pokémon with specific roles
    parsed.pokemon_with_roles.forEach(pokemonRole => {
        team.pokemons.forEach(p => {
            if (p.name.toLowerCase() === pokemonRole.pokemon.toLowerCase()) {
                const stats = p.stats || {};
                if (pokemonRole.role === "strong attacker" && stats.attack >= 100) {
                    matchCount += 20;
                }
                if (pokemonRole.role === "strong special attacker" && stats["special-attack"] >= 100) {
                    matchCount += 20;
                }
                if (pokemonRole.role === "defensive" && stats.defense >= 100) {
                    matchCount += 20;
                }
                if (pokemonRole.role === "specially defensive" && stats["special-defense"] >= 100) {
                    matchCount += 20;
                }
                if (pokemonRole.role === "speedy" && stats.speed >= 100) {
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

    return matchCount;
}

function generatePokepaste(instruction) {
    const parsed = parseInstruction(instruction);
    console.log(parsed);

    // Calculate match scores for all teams
    const matchScores = data.map(team => matchTeam(instruction, team));

    // Find the maximum match score
    const maxScore = Math.max(...matchScores);

    // Find all teams with the maximum match score
    const bestTeams = data.filter((team, index) => matchScores[index] === maxScore);

    // Extract only the required fields for each team
    const simplifiedTeams = bestTeams.map(team => ({
        filename: team.filename || "unknown",
        pokemons: team.pokemons.map(p => ({
            name: p.name,
            ability: p.ability,
            item: p.item,
            moves: p.moves.slice(0, 4).map(m => typeof m === 'object' ? m.name : m),
            tera_type: p.tera_type,
            sprite: p.sprites?.front_default
        }))
    }));

    return simplifiedTeams;
}

// Expose the generatePokepaste function to the global scope
window.generatePokepaste = generatePokepaste;