import json
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from transformers import pipeline
import pickle
from collections import Counter

# Helper function to convert sets to lists for JSON serialization
def convert_sets_to_lists(obj):
    """
    Recursively convert all sets in a dictionary or list to lists.
    """
    if isinstance(obj, set):
        return list(obj)
    elif isinstance(obj, dict):
        return {key: convert_sets_to_lists(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_sets_to_lists(item) for item in obj]
    return obj

# Load processed data
with open("data/processed_data.json", "r") as f:
    data = json.load(f)

# Helper function to determine team attributes dynamically
def get_team_attributes(pokemons):
    """
    Analyze a team of Pokémon and generate dynamic labels.
    """
    attributes = {
        "types": [],  # List of all types in the team
        "primary_type": None,  # Most common type in the team
        "playstyle": None,  # Offensive, Defensive, or Balanced
        "theme": None,  # Theme based on primary type (e.g., water, fire)
        "average_stats": {},  # Average stats for the team
        "move_types": [],  # All move types in the team
        "abilities": [],  # All abilities in the team
        "tera_types": [],  # All Tera Types in the team
        "type_coverage": set(),  # Types covered by moves
        "weaknesses": set(),  # Team weaknesses
        "resistances": set()  # Team resistances
    }

    # Count types, move types, abilities, and Tera Types
    type_count = Counter()
    move_type_count = Counter()
    ability_count = Counter()
    tera_type_count = Counter()
    total_stats = {"hp": 0, "attack": 0, "defense": 0, "special-attack": 0, "special-defense": 0, "speed": 0}

    for pokemon in pokemons:
        # Count types
        for type_name in pokemon.get("types", []):
            type_count[type_name] += 1

        # Count move types
        for move in pokemon.get("moves", []):
            move_type_count[move["type"]] += 1
            attributes["type_coverage"].add(move["type"])

        # Count abilities
        ability_count[pokemon.get("ability", "Unknown")] += 1

        # Count Tera Types
        tera_type = pokemon.get("tera_type", "Unknown")
        if tera_type != "Unknown":
            tera_type_count[tera_type] += 1

        # Sum stats for averaging
        for stat, value in pokemon.get("stats", {}).items():
            total_stats[stat] += value

    # Determine primary type (most common type)
    if type_count:
        attributes["primary_type"] = type_count.most_common(1)[0][0]
        attributes["theme"] = attributes["primary_type"]

    # Determine playstyle based on stats
    avg_attack = total_stats["attack"] / len(pokemons)
    avg_defense = total_stats["defense"] / len(pokemons)
    avg_special_attack = total_stats["special-attack"] / len(pokemons)
    avg_special_defense = total_stats["special-defense"] / len(pokemons)
    if avg_attack + avg_special_attack > avg_defense + avg_special_defense:
        attributes["playstyle"] = "offensive"
    elif avg_defense + avg_special_defense > avg_attack + avg_special_attack:
        attributes["playstyle"] = "defensive"
    else:
        attributes["playstyle"] = "balanced"

    # Calculate average stats
    for stat, total in total_stats.items():
        attributes["average_stats"][stat] = total / len(pokemons)

    # Add all types, move types, abilities, and Tera Types to the attributes
    attributes["types"] = list(type_count.keys())
    attributes["move_types"] = list(move_type_count.keys())
    attributes["abilities"] = list(ability_count.keys())
    attributes["tera_types"] = list(tera_type_count.keys())

    return attributes

# Create a dataset for training
team_descriptions = []
team_attributes = []

for team in data:
    description = " ".join([p["name"] for p in team["pokemons"]])
    attributes = get_team_attributes(team["pokemons"])  # Dynamic labels
    team_descriptions.append(description)
    team_attributes.append(attributes)

# Convert sets to lists for JSON serialization
team_attributes = convert_sets_to_lists(team_attributes)

# Save team attributes for later use
with open("data/team_attributes.json", "w") as f:
    json.dump(team_attributes, f, indent=4)

# Train a TF-IDF based recommender
vectorizer = TfidfVectorizer()
tfidf_matrix = vectorizer.fit_transform(team_descriptions)

# Save the recommender
with open("models/recommender.pkl", "wb") as f:
    pickle.dump(vectorizer, f)

print("Training complete! Models saved to the 'models' folder.")