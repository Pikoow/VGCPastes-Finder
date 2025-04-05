import os
import json
import logging
import requests
from tqdm import tqdm

# PokeAPI base URLs
POKEAPI_POKEMON_URL = "https://pokeapi.co/api/v2/pokemon/"
POKEAPI_MOVE_URL = "https://pokeapi.co/api/v2/move/"

def fetch_pokemon_data(pokemon_name):
    """ 
    Fetch detailed Pokémon data from PokeAPI.
    """
    try:
        formatted_name = pokemon_name.replace(" ", "-").lower()
        if formatted_name.endswith("(m)") or formatted_name.endswith("(f)"):
            formatted_name = formatted_name[:-4]
        if "(" in formatted_name and ")" in formatted_name:
            formatted_name = formatted_name.split("(")[1][:-1].strip()
        if formatted_name.startswith("ogerpon-"):
            formatted_name += "-mask"
        elif formatted_name in ["tornadus", "landorus", "thundurus", "enamorus"]:
            formatted_name += "-incarnate"
        elif formatted_name == "urshifu":
            formatted_name += "-single-strike"
        elif formatted_name == "tatsugiri":
            formatted_name += "-curly"
        elif formatted_name == "indeedee-f":
            formatted_name = "indeedee-female"
        elif formatted_name == "indeedee":
            formatted_name = "Indeedee-male"
        elif formatted_name == "necrozma-dawn-wings":
            formatted_name = "necrozma-dawn"
        elif formatted_name == "necrozma-dusk-mane":
            formatted_name = "necrozma-dusk"
        elif formatted_name == "gastrodon-east":
            formatted_name = "gastrodon"
        elif formatted_name == "gastrodon-west":
            formatted_name = "gastrodon"
        elif formatted_name == "giratina":
            formatted_name += "-altered"
        elif formatted_name == "maushold-four":
            formatted_name = "maushold-family-of-four"
        elif formatted_name == "maushold":
            formatted_name = "maushold-family-of-three"
        elif formatted_name == "mimikyu":
            formatted_name = "mimikyu-disguised"
        elif formatted_name == "basculegion":
            formatted_name = "Basculegion-male"
        elif formatted_name == "basculegion-f":
            formatted_name = "Basculegion-female"
        elif formatted_name == "toxtricity":
            formatted_name = "toxtricity-amped"
        elif formatted_name == "tauros-paldea-blaze":
            formatted_name = "tauros-paldea-blaze-breed"
        elif formatted_name == "tauros-paldea-aqua":
            formatted_name = "tauros-paldea-aqua-breed"
        elif formatted_name == "sinistcha-masterpiece":
            formatted_name = "sinistcha"
        response = requests.get(f"{POKEAPI_POKEMON_URL}{formatted_name}")
        response.raise_for_status()  # Raise an error for bad status codes
        data = response.json()
        
        # Extract relevant fields
        pokemon_data = {
            "types": [t["type"]["name"] for t in data["types"]],
            "stats": {s["stat"]["name"]: s["base_stat"] for s in data["stats"]},
            "height": data["height"],
            "weight": data["weight"],
            "base_experience": data["base_experience"],
            "abilities": [a["ability"]["name"] for a in data["abilities"]],
            "sprites": {
                "front_default": data["sprites"]["front_default"],
                "back_default": data["sprites"]["back_default"]
            }
        }
        return pokemon_data
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching data for {pokemon_name}: {e}")
        return None

def fetch_move_data(move_name):
    """
    Fetch detailed move data from PokeAPI.
    """
    try:
        formatted_name = move_name.replace(" ", "-").lower()
        response = requests.get(f"{POKEAPI_MOVE_URL}{formatted_name}")
        response.raise_for_status()  # Raise an error for bad status codes
        data = response.json()
        
        # Extract relevant fields
        move_data = {
            "name": move_name,
            "type": data["type"]["name"],
            "power": data["power"],
            "accuracy": data["accuracy"],
            "pp": data["pp"],
            "damage_class": data["damage_class"]["name"]
        }
        return move_data
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching data for move {move_name}: {e}")
        return None

def parse_pokepaste(file_path):
    """
    Parse a Poképaste file and extract detailed Pokémon and move data.
    """
    with open(file_path, 'r', encoding="utf-8") as f:
        content = f.read().splitlines()
    
    pokemons = []
    current_pokemon = {}
    
    for line in content:
        line = line.strip()
        if line == "":
            continue
        
        # Start of a new Pokémon
        if "@" in line:
            if current_pokemon:
                if validate_pokemon(current_pokemon):
                    pokemons.append(current_pokemon)
                current_pokemon = {}
            
            # Extract name and item
            parts = line.split(" @ ")
            if len(parts) == 2:
                name, item = parts
                if name.endswith("(m)") or name.endswith("(f)"):
                    name = name[:-4]
                if "(" in name and ")" in name:
                    name = name.split("(")[1][:-1].strip()
                current_pokemon["name"] = name.strip()
                current_pokemon["item"] = item.strip()
            else:
                # Handle cases where the format is unexpected
                current_pokemon["name"] = parts[0].strip()
                current_pokemon["item"] = "Unknown"
            
            # Fetch additional data from PokeAPI
            pokemon_data = fetch_pokemon_data(current_pokemon["name"])
            if pokemon_data:
                current_pokemon.update(pokemon_data)
        
        # Ability line
        elif line.startswith("Ability:"):
            ability = line.split(": ", 1)[1]
            current_pokemon["ability"] = ability.strip()
        
        # Tera Type line
        elif line.startswith("Tera Type:"):
            tera_type = line.split(": ", 1)[1]
            current_pokemon["tera_type"] = tera_type.strip()
        
        # Moves
        elif line.startswith("- "):
            if "moves" not in current_pokemon:
                current_pokemon["moves"] = []
            move = line[2:].strip()
            move_data = fetch_move_data(move)
            if move_data:
                current_pokemon["moves"].append(move_data)
    
    # Add the last Pokémon
    if current_pokemon and validate_pokemon(current_pokemon):
        pokemons.append(current_pokemon)
    
    return pokemons

def validate_pokemon(pokemon):
    """
    Validate that a Pokémon has the required fields.
    """
    required_fields = ["name", "moves"]
    for field in required_fields:
        if field not in pokemon:
            return False
    return True

def preprocess_data(folder_path, max_files=None):
    """
    Preprocess all Poképaste files in the specified folder.
    """
    all_pokepastes = []
    problematic_files = []
    processed_count = 0
    
    logging.basicConfig(filename="preprocess.log", level=logging.ERROR, format="%(asctime)s - %(message)s")
    
    with os.scandir(folder_path) as entries:
        for entry in tqdm(list(entries), desc="Processing files"):
            if entry.name.endswith(".txt") and entry.is_file():
                if max_files is not None and processed_count >= max_files:
                    print(f"Stopping after processing {max_files} files.")
                    break
                
                file_path = entry.path
                try:
                    pokemons = parse_pokepaste(file_path)
                    all_pokepastes.append({
                        "filename": entry.name,
                        "pokemons": pokemons,
                        "num_pokemons": len(pokemons),
                        "total_moves": sum(len(p["moves"]) for p in pokemons)
                    })
                    processed_count += 1
                except Exception as e:
                    problematic_files.append((entry.name, str(e)))
                    logging.error(f"Error processing {entry.name}: {e}")
    
    with open("data/processed_data.json", "w", encoding="utf-8") as f:
        json.dump(all_pokepastes, f, indent=4)
    
    if problematic_files:
        print("\nProblematic files:")
        for file, error in problematic_files:
            print(f"{file}: {error}")

if __name__ == "__main__":
    # Set max_files to a small number for testing (e.g., 5)
    preprocess_data("data/raw_pokepastes")