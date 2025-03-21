import json
import pickle
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline
import requests
import re

# Load models
with open("models/recommender.pkl", "rb") as f:
    vectorizer = pickle.load(f)

nlp_model = pipeline("text-classification", model="models/nlp_model")

# Load processed data
with open("data/processed_data.json", "r") as f:
    data = json.load(f)

# Fetch all items from Showdown
def fetch_all_items():
    # URL of the items.js file
    url = "https://play.pokemonshowdown.com/data/items.js"
    
    # Fetch the content of the items.js file
    response = requests.get(url)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch data: {response.status_code}")
    
    text = response.text
    match = re.search(r'exports\.BattleItems = ({.*?});', text, re.DOTALL)
    if not match:
        raise Exception("Could not find the BattleItems object in the JavaScript file.")
    
    items = match.group(1)

    pattern = r'name:"([^"]+)"'
    
    names = re.findall(pattern, items)
    
    return names

all_items = fetch_all_items()

def extract_keywords(instruction):
    """
    Extract keywords from the instruction using the NLP model.
    """
    # Use the NLP model to classify the instruction (if needed)
    attributes = nlp_model(instruction)
    return attributes

def parse_instruction(instruction):
    """
    Parse the instruction to detect Pokémon, items, Tera types, types, and roles.
    """
    parsed = {
        "pokemon": [],  # List of Pokémon names
        "pokemon_with_items": [],  # List of Pokémon with specific items (e.g., "Pikachu holding Light Ball")
        "pokemon_with_tera": [],  # List of Pokémon with specific Tera types (e.g., "Pikachu with Tera Electric")
        "pokemon_with_roles": [],  # List of Pokémon with specific roles (e.g., "Water-type special attacker")
        "types": [],  # List of types (e.g., "Water-type")
        "roles": []  # List of roles (e.g., "special attacker")
    }

    # Detect Pokémon names
    for team in data:
        for p in team["pokemons"]:
            if p["name"].lower() in instruction.lower() and p["name"] not in parsed["pokemon"]:
                parsed["pokemon"].append(p["name"])

    # Detect Pokémon with specific items (e.g., "Pikachu holding Light Ball")
    for pokemon in parsed["pokemon"]:
        for item in all_items:
            if f"{pokemon.lower()} with {item.lower()}" in instruction.lower() or f"{pokemon.lower()} holding {item.lower()}" in instruction.lower():
                parsed["pokemon_with_items"].append({"pokemon": pokemon, "item": item})

    # Detect Pokémon with specific Tera types (e.g., "Pikachu with Tera Electric")
    tera_types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"]
    for pokemon in parsed["pokemon"]:
        for tera in tera_types:
            if f"tera {tera.lower()} {pokemon.lower()}" in instruction.lower():
                parsed["pokemon_with_tera"].append({"pokemon": pokemon, "tera_type": tera})

    # Detect Pokémon with specific roles (e.g., "Water-type special attacker")
    roles = {
        "strong attacker": ["attack", "physical attacker"],
        "strong special attacker": ["special attack", "special attacker"],
        "defensive": ["defense", "defensive"],
        "specially defensive": ["special defense", "specially defensive"],
        "speedy": ["speed", "speedy"]
    }
    for role, keywords in roles.items():
        if any(keyword in instruction.lower() for keyword in keywords):
            parsed["roles"].append(role)
            for pokemon in parsed["pokemon"]:
                if pokemon.lower() in instruction.lower():
                    parsed["pokemon_with_roles"].append({"pokemon": pokemon, "role": role})

    # Detect types (e.g., "Water-type")
    types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark"]
    for type_ in types:
        if f"{type_.lower()} type" in instruction.lower() or f"{type_.lower()}-type" in instruction.lower():
            parsed["types"].append(type_)

    return parsed

def match_team(instruction, team):
    """
    Check if a team matches the given instruction and count the number of matches.
    """
    parsed = parse_instruction(instruction)
    match_count = 0

    # Check for Pokémon in the instruction
    for p in team["pokemons"]:
        if p["name"].lower() in [name.lower() for name in parsed["pokemon"]]:
            match_count += 10  # Base points for matching Pokémon

    # Check for Pokémon with specific items (e.g., "Pikachu holding Light Ball")
    for pokemon_item in parsed["pokemon_with_items"]:
        for p in team["pokemons"]:
            if p["name"].lower() == pokemon_item["pokemon"].lower() and p.get("item", "").lower() == pokemon_item["item"].lower():
                match_count += 50  # High points for exact match (Pokémon + item)

    # Check for Pokémon with specific Tera types (e.g., "Pikachu with Tera Electric")
    for pokemon_tera in parsed["pokemon_with_tera"]:
        for p in team["pokemons"]:
            if p["name"].lower() == pokemon_tera["pokemon"].lower() and p.get("tera_type", "").lower() == pokemon_tera["tera_type"].lower():
                match_count += 30  # High points for exact match (Pokémon + Tera type)

    # Check for Pokémon with specific roles (e.g., "Water-type special attacker")
    for pokemon_role in parsed["pokemon_with_roles"]:
        for p in team["pokemons"]:
            if p["name"].lower() == pokemon_role["pokemon"].lower():
                stats = p.get("stats", {})
                if pokemon_role["role"] == "strong attacker" and stats.get("attack", 0) >= 100:
                    match_count += 20
                if pokemon_role["role"] == "strong special attacker" and stats.get("special-attack", 0) >= 100:
                    match_count += 20
                if pokemon_role["role"] == "defensive" and stats.get("defense", 0) >= 100:
                    match_count += 20
                if pokemon_role["role"] == "specially defensive" and stats.get("special-defense", 0) >= 100:
                    match_count += 20
                if pokemon_role["role"] == "speedy" and stats.get("speed", 0) >= 100:
                    match_count += 20

    # Check for types in the instruction
    for p in team["pokemons"]:
        if any(type_.lower() in [t.lower() for t in p.get("types", [])] for type_ in parsed["types"]):
            match_count += 5  # Points for matching types

    return match_count

def generate_pokepaste(instruction):
    """
    Generate a Poképaste based on the instruction.
    """
    parsed = parse_instruction(instruction)
    print(parsed)

    # Find the best matching team
    team_descriptions = [" ".join([p["name"] for p in team["pokemons"]]) for team in data]
    tfidf_matrix = vectorizer.transform(team_descriptions)
    query_vector = vectorizer.transform([instruction])
    similarities = cosine_similarity(query_vector, tfidf_matrix).flatten()

    # Calculate match scores for all teams
    match_scores = [match_team(instruction, team) for team in data]

    # Find the team with the highest match score
    best_match_index = np.argmax(match_scores)

    # Extract only the required fields
    team = data[best_match_index]
    simplified_team = {
        "filename": team.get("filename", "unknown"),
        "pokemons": [
            {
                "name": p["name"],
                "ability": p["ability"],
                "item": p["item"],
                "moves": [m["name"] if isinstance(m, dict) else m for m in p.get("moves", [])[:4]],
                "tera_type": p["tera_type"],
                "sprite": p["sprites"]["front_default"]
            }
            for p in team["pokemons"]
        ]
    }

    return simplified_team

if __name__ == "__main__":
    instruction = "I want a team with a Pikachu holding a Light Ball and using Thunderbolt. Include a strong attacker and a Water-type Pokémon."
    pokepaste = generate_pokepaste(instruction)
    print(json.dumps(pokepaste, indent=4))