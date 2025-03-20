import json
import pickle
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import requests
import os

# Load models
with open("models/recommender.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# Hugging Face API details
API_URL = "https://api-inference.huggingface.co/models/your-model-name"
API_TOKEN = os.getenv("HUGGINGFACE_API_KEY")

# Load processed data
with open("data/processed_data.json", "r") as f:
    data = json.load(f)

# Fetch all items from PokeAPI
def fetch_all_items():
    """
    Fetch all items from PokeAPI.
    """
    url = "https://pokeapi.co/api/v2/item?limit=100000&offset=0"
    response = requests.get(url)
    if response.status_code == 200:
        items_data = response.json()
        return [item["name"] for item in items_data["results"]]
    else:
        print(f"Failed to fetch items from PokeAPI. Status code: {response.status_code}")
        return []

all_items = fetch_all_items()

def query_huggingface_model(text):
    """
    Query the Hugging Face Inference API with the given text.
    """
    headers = {"Authorization": f"Bearer {API_TOKEN}"}
    payload = {"inputs": text}
    response = requests.post(API_URL, headers=headers, json=payload)
    
    if response.status_code != 200:
        print(f"Error: Hugging Face API returned status code {response.status_code}")
        print(f"Response content: {response.text}")
        return None
    
    try:
        return response.json()
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from Hugging Face API: {e}")
        print(f"Response content: {response.text}")
        return None

def parse_instruction(instruction):
    """
    Parse the instruction to detect Pokémon, items, Tera types, types, and roles.
    """
    parsed = {
        "pokemon": [],
        "items": [],
        "tera_types": [],
        "types": [],
        "roles": []
    }

    # Use Hugging Face's API to extract keywords or classify the instruction
    result = query_huggingface_model(instruction)
    if result is not None:
        # Example: Extract keywords or classifications from the result
        # (You'll need to adapt this based on your model's output format)
        if isinstance(result, list) and len(result) > 0:
            keywords = result[0].get("label", "")  # Adjust based on your model's output
            parsed["types"].append(keywords)  # Example: Add extracted keywords to types

    # Detect Pokémon names
    for team in data:
        for p in team["pokemons"]:
            if p["name"].lower() in instruction.lower():
                parsed["pokemon"].append(p["name"])

    # Detect items
    for item in all_items:
        if item.lower() in instruction.lower():
            parsed["items"].append(item)

    # Detect Tera types
    tera_types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark", "stellar"]
    for tera in tera_types:
        if f"tera {tera}" in instruction.lower():
            parsed["tera_types"].append(tera)

    # Detect types
    types = ["steel", "fighting", "dragon", "water", "electric", "electrik", "fairy", "fire", "ice", "bug", "insect", "normal", "grass", "poison", "psychic", "rock", "ground", "ghost", "flying", "dark"]
    for type_ in types:
        if f"{type_} type" in instruction.lower() or f"{type_} type" in instruction.lower():
            parsed["types"].append(type_)

    # Detect roles
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
            match_count += 1

    # Check for items in the instruction
    for p in team["pokemons"]:
        if p.get("item", "").lower() in [item.lower() for item in parsed["items"]]:
            match_count += 1

    # Check for Tera types in the instruction
    for p in team["pokemons"]:
        if p.get("tera_type", "").lower() in [tera.lower() for tera in parsed["tera_types"]]:
            match_count += 1

    # Check for types in the instruction
    for p in team["pokemons"]:
        if any(type_.lower() in [t.lower() for t in p.get("types", [])] for type_ in parsed["types"]):
            match_count += 1

    # Check for roles in the instruction
    for p in team["pokemons"]:
        stats = p.get("stats", {})
        if "strong attacker" in parsed["roles"] and stats.get("attack", 0) >= 100:
            match_count += 1
        if "strong special attacker" in parsed["roles"] and stats.get("special-attack", 0) >= 100:
            match_count += 1
        if "defensive" in parsed["roles"] and stats.get("defense", 0) >= 100:
            match_count += 1
        if "specially defensive" in parsed["roles"] and stats.get("special-defense", 0) >= 100:
            match_count += 1
        if "speedy" in parsed["roles"] and stats.get("speed", 0) >= 100:
            match_count += 1

    return match_count

def generate_pokepaste(instruction):
    """
    Generate a Poképaste based on the instruction.
    """
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
                "tera_type": p["tera_type"]
            }
            for p in team["pokemons"]
        ]
    }

    return simplified_team

if __name__ == "__main__":
    instruction = "I want a team with a Pikachu holding a Light Ball and using Thunderbolt. Include a strong attacker and a Water-type Pokémon."
    pokepaste = generate_pokepaste(instruction)
    print(json.dumps(pokepaste, indent=4))