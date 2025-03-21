# fetch_pokepastes.py
import os
import pandas as pd
import requests
from bs4 import BeautifulSoup
import logging
from tqdm import tqdm  # For progress bar
import argparse
import shutil  # For folder cleanup

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def clean_folder(folder):
    """Delete all files in the specified folder."""
    if os.path.exists(folder):
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)  # Delete the file or symbolic link
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)  # Delete subdirectories
            except Exception as e:
                logging.error(f"Failed to delete {file_path}. Reason: {e}")
        logging.info(f"Cleaned folder: {folder}")
    else:
        logging.info(f"Folder {folder} does not exist. Skipping cleanup.")

def fetch_pokepaste(url):
    """Fetch the content of a Poképaste from a given URL and extract the team data and title."""
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad status codes
        soup = BeautifulSoup(response.text, "html.parser")
        
        # Extract all <pre> tags containing the team data
        team_data = []
        for pre_tag in soup.find_all("pre"):
            team_data.append(pre_tag.get_text())
        
        # Combine the team data into a single string
        team_content = "".join(team_data)
        return team_content
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching {url}: {e}")
        return None

def save_pokepaste(content, filename, folder):
    """Save the Poképaste content to a file."""
    if not os.path.exists(folder):
        os.makedirs(folder)
    filepath = os.path.join(folder, filename)
    
    with open(filepath, "w", encoding="utf-8") as file:
        file.write(content)

def fetch_and_save_pokepastes(excel_file, sheet_name, link_column, title_column, folder):
    """
    Fetch Poképastes from links in an Excel file and save them as text files.
    :param excel_file: Path to the Excel file containing the links.
    :param sheet_name: Name of the sheet in the Excel file.
    :param link_column: Name of the column containing the links.
    :param title_column: Name of the column containing the names.
    :param folder: Folder to save the Poképastes.
    """
    # Clean the folder before starting
    clean_folder(folder)

    # Read the Excel file, skipping the first row
    df = pd.read_excel(excel_file, sheet_name=sheet_name, skiprows=1)

    # Check if the link and title columns exist
    if link_column not in df.columns:
        raise ValueError(f"Column '{link_column}' not found in the Excel file.")
    if title_column not in df.columns:
        raise ValueError(f"Column '{title_column}' not found in the Excel file.")

    # Fetch and save each Poképaste
    for index, row in tqdm(df.iterrows(), total=len(df), desc="Fetching Poképastes"):
        url = row[link_column]
        if pd.notna(url):  # Skip empty cells
            content = fetch_pokepaste(url)
            if content:
                # Use the title from the title_column as the filename (sanitize to remove invalid characters)
                title = row[title_column]
                if pd.notna(title):  # Check if the title is not empty
                    sanitized_title = "".join(c for c in str(title) if c.isalnum() or c in (" ", "_")).rstrip()
                    filename = f"{sanitized_title}.txt"
                    save_pokepaste(content, filename, folder)
                else:
                    logging.warning(f"Empty title for URL: {url}. Skipping this entry.")

def main():
    # Set up command-line argument parsing
    parser = argparse.ArgumentParser(description="Fetch Poképastes from an Excel file.")
    parser.add_argument("--excel_file", default="pokepaste_links.xlsx", help="Path to the Excel file.")
    parser.add_argument("--sheet_name", default="SV Regulation G", help="Name of the sheet in the Excel file.")
    parser.add_argument("--link_column", default="Unnamed: 24", help="Name of the column containing the links.")
    parser.add_argument("--title_column", default="Click here to visit our Twitter for latest updates!", help="Name of the column containing the names.")
    parser.add_argument("--folder", default="data/raw_pokepastes", help="Folder to save the Poképastes.")
    args = parser.parse_args()

    # Fetch and save Poképastes
    logging.info("Starting Poképaste fetch...")
    fetch_and_save_pokepastes(args.excel_file, args.sheet_name, args.link_column, args.title_column, args.folder)
    logging.info("Poképaste fetch complete!")

if __name__ == "__main__":
    main()