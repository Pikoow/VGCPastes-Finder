// --- Theme Toggle ---
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

// Function to apply theme based on mode
function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.documentElement.classList.add("dark");
        themeIcon.textContent = "☀️"; // Sun icon for dark mode
        localStorage.theme = "dark";
    } else {
        document.documentElement.classList.remove("dark");
        themeIcon.textContent = "🌙"; // Moon icon for light mode
        localStorage.theme = "light";
    }
}

// Event listener for theme toggle button
themeToggle.addEventListener("click", () => {
    const isDarkMode = !document.documentElement.classList.contains("dark");
    applyTheme(isDarkMode);
});

// Apply initial theme based on localStorage or system preference
applyTheme(localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches));


// --- Format Help Toggle ---
const formatHelpBtn = document.getElementById("format-help-btn");
const formatHelp = document.getElementById("format-help");

formatHelpBtn.addEventListener("click", () => {
    // Toggle the 'visible' class for transitions
    formatHelp.classList.toggle("visible");
});


// --- "Did You Mean" Suggestion Logic ---

// Words to ignore for suggestions (common words, fillers)
const IGNORED_WORDS = new Set([
    'a', 'an', 'the', 'and', 'with', 'holding', 'team', 'i', 'want', 'like',
    'need', 'looking', 'for', 'that', 'has', 'have', 'had', 'my', 'can', 'give', 'me',
    'your', 'our', 'their', 'this', 'these', 'those', 'some', 'any', 'about',
    'all', 'every', 'each', 'which', 'what', 'when', 'where', 'why', 'find',
    'how', 'many', 'much', 'more', 'less', 'most', 'least', 'only', 'show',
    'just', 'also', 'too', 'very', 'really', 'quite', 'somewhat', 'tera',
    'rather', 'type', 'types', 'move', 'moves', 'ability', 'abilities', 'item', 'items',
    'of', 'in', 'out', 'on', 'off', 'up', 'down', 'at', 'by', 'via', 'per',
    'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'it', 'its',
    'no', 'not', 'nor', 'or', 'but', 'so', 'if', 'then', 'than'
]);

// Levenshtein distance function for string similarity
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(a.length + 1).fill(null).map(() =>
        Array(b.length + 1).fill(null)
    );

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Deletion
                matrix[i][j - 1] + 1,      // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }
    return matrix[a.length][b.length];
}


// Function to find the closest Pokémon name match for a given input word
function findClosestPokemonName(inputWord) {
    const inputLower = inputWord.toLowerCase();

    // Basic checks: ignore empty, short, long, or common words
    if (!inputLower || inputLower.length < 3 || inputLower.length > 20 || IGNORED_WORDS.has(inputLower)) {
        return null;
    }

    // Ensure pokemonNames list is available and populated
    if (!window.pokemonNames || window.pokemonNames.size === 0) {
        console.warn("Pokémon names list not available for suggestions.");
        return null;
    }

    const pokemonNamesArray = [...window.pokemonNames];

    // Exact match check (case-insensitive) - if exact match, no suggestion needed
    if (pokemonNamesArray.includes(inputLower)) {
        return null;
    }

    let closestMatch = null;
    let minDistance = 4; // Maximum allowed distance for a suggestion (adjust as needed)

    for (const name of pokemonNamesArray) {
        if (!name) continue; // Skip null/undefined names
        // Optimization: skip if lengths differ too much
        if (Math.abs(name.length - inputLower.length) > minDistance) {
            continue;
        }

        const distance = levenshteinDistance(inputLower, name);

        if (distance < minDistance) {
            minDistance = distance;
            closestMatch = name;
        } else if (distance === minDistance) {
            // Prefer shorter names if distances are equal? Or keep first found?
            // Keeping the first found for simplicity.
        }
    }

    // Return the *original case* version of the closest match
    if (closestMatch) {
        // Find the original casing from the data if possible (more reliable)
        const originalCaseName = data?.flatMap(t => t.pokemons).find(p => p.name?.toLowerCase() === closestMatch)?.name || closestMatch;
        return originalCaseName;
    }

    return null;
}

// Event listener for the instruction input field to trigger suggestions
document.getElementById("instruction").addEventListener("input", function() {
    const inputText = this.value;
    const didYouMeanDiv = document.getElementById("did-you-mean");
    const suggestionLink = document.getElementById("suggestion-link");

    // Simple approach: check the last word typed
    const words = inputText.trim().split(/[\s-]+/); // Split by space or hyphen
    const lastWord = words[words.length - 1];

    let suggestion = null;
    let suggestedPokemon = findClosestPokemonName(lastWord);

    if (suggestedPokemon && suggestedPokemon.toLowerCase() !== lastWord.toLowerCase()) {
        // Construct the suggested text by replacing the last word
        // Find the index of the last word to replace it correctly, handling hyphens
        const lastWordIndex = inputText.lastIndexOf(lastWord);
        if (lastWordIndex !== -1) {
            suggestion = inputText.substring(0, lastWordIndex) + suggestedPokemon;
        }
    }

    // Show or hide the suggestion link
    if (suggestion && suggestion.toLowerCase() !== inputText.trim().toLowerCase()) {
        suggestionLink.textContent = `"${suggestion}"`;
        suggestionLink.onclick = (e) => {
            e.preventDefault();
            document.getElementById("instruction").value = suggestion + " "; // Add space after suggestion
            didYouMeanDiv.classList.add("hidden"); // Hide after clicking
            document.getElementById("instruction").focus(); // Refocus input
            // Optionally trigger search immediately: triggerSearch();
        };
        didYouMeanDiv.classList.remove("hidden");
    } else {
        didYouMeanDiv.classList.add("hidden");
    }
});


// --- Search Functionality ---
const searchBtn = document.getElementById("search-btn");
const instructionInput = document.getElementById("instruction");
const teamContainer = document.getElementById("team-container");
const teamSheetContainer = document.getElementById("team-sheet-container"); // Target wrapper for overflow
const teamHeader = document.getElementById("team-header");
const teamTitle = document.getElementById("team-title");
const copyAllBtn = document.getElementById("copy-all-btn");
const otherTeamsContainer = document.getElementById("other-teams-container");
const otherTeamsTitle = document.getElementById("other-teams-title");
const otherTeamsList = document.getElementById("other-teams-list");
const searchText = document.getElementById("search-text");
const loadingSpinner = document.getElementById("loading-spinner");
const initialMessage = document.getElementById("initial-message"); // Get initial message element

// --- State Variables for Current Search ---
let currentSearchResults = []; // Stores the full list of teams from the last search
let currentMainTeamIndex = -1; // Stores the index of the team currently in the main display

// Function to trigger the search process
async function triggerSearch() {
    const instruction = instructionInput.value.trim();
    if (!instruction) return; // Don't search if input is empty

    // --- UI Updates: Start Loading ---
    if(initialMessage) initialMessage.classList.add('hidden'); // Hide initial message
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true; // Disable button during search
    teamContainer.innerHTML = ''; // Clear previous results
    teamTitle.textContent = 'Loading Team...';
    copyAllBtn.classList.add('hidden');
    otherTeamsContainer.classList.add('hidden'); // Hide other teams section initially
    otherTeamsTitle.classList.add('hidden');
    otherTeamsList.innerHTML = '';
    document.getElementById("did-you-mean").classList.add("hidden"); // Hide suggestion
    currentSearchResults = []; // Reset search results
    currentMainTeamIndex = -1; // Reset main team index

    // Simulate network delay/processing time (optional)
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        // Call the generation function from generate.js
        // Ensure generatePokepaste is awaited if it's async
        const [teams, noDetect] = await window.generatePokepaste(instruction);

        if ((!teams || teams.length === 0)) {
             // Handle case where generatePokepaste returns truly empty or error
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try different keywords or check the format help (?).</div>`;
            otherTeamsContainer.classList.add('hidden'); // Hide other teams section

        } else {
             // We have at least one team
             currentSearchResults = teams; // Store the full results
             currentMainTeamIndex = 0; // Initially display the first team

             const mainTeam = currentSearchResults[currentMainTeamIndex];

             // Update main team title and display
             updateMainTeamDisplay(mainTeam);

             // Handle "other" teams (if more than one team was returned)
             if (currentSearchResults.length > 1) {
                 updateOtherTeamsDisplay(); // Display previews for others
             } else {
                  otherTeamsContainer.classList.add('hidden'); // Hide if only one team total
             }

             // Adjust message if the main result was random due to no detection
             if (noDetect && mainTeam) {
                 otherTeamsContainer.classList.remove('hidden'); // Show the container
                 const count = currentSearchResults.length - 1;
                 otherTeamsTitle.textContent = `No strong matches found. Showing a relevant team${count > 0 ? ' and potential alternatives:' : '.'}`;
                 otherTeamsTitle.classList.remove('hidden');
                 if (count === 0) {
                    otherTeamsList.innerHTML = ''; // No others to show if only one random result
                 }
                 // The main team is already displayed
             }
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">Sorry, something went wrong during the search. Please try again later.<br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        currentSearchResults = [];
        currentMainTeamIndex = -1;
    } finally {
        // --- UI Updates: End Loading ---
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
        searchBtn.disabled = false; // Re-enable button
    }
}

// Event listener for the search button
searchBtn.addEventListener("click", triggerSearch);

// Allow searching by pressing Enter in the input field
instructionInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault(); // Prevent default form submission
        triggerSearch();
    }
});


// --- Display Functions ---

// Function to update the main team display area
function updateMainTeamDisplay(team) {
    if (!team) return;
    teamTitle.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
    displayTeamInGrid(team, teamContainer); // Use the grid display function
    copyAllBtn.classList.remove('hidden');
    copyAllBtn.onclick = () => copyTeamToClipboard(team);
}

// Function to update the "Other Teams" preview section
function updateOtherTeamsDisplay() {
    otherTeamsList.innerHTML = ''; // Clear previous list

    // Filter out the current main team and create previews for the rest
    const otherTeams = currentSearchResults.filter((_, index) => index !== currentMainTeamIndex);

    if (otherTeams.length > 0) {
        otherTeamsContainer.classList.remove('hidden');
        otherTeamsTitle.textContent = `${otherTeams.length} other potential match${otherTeams.length > 1 ? 'es' : ''}:`;
        otherTeamsTitle.classList.remove('hidden');

        currentSearchResults.forEach((team, index) => {
            // Only create previews for teams NOT currently in the main display
            if (index === currentMainTeamIndex) return;

            const teamPreview = document.createElement('div');
            teamPreview.className = 'other-team-preview border p-1.5 rounded-sm cursor-pointer';
            teamPreview.title = `Click to view: ${team.filename.split('.')[0].replace(/_/g, ' ')}`;
            teamPreview.dataset.teamIndex = index; // Store the original index

            const teamName = document.createElement('div');
            teamName.className = 'text-xs font-semibold truncate mb-1 team-name-preview';
            teamName.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
            teamPreview.appendChild(teamName);

            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'flex flex-wrap gap-1 justify-center';
            team.pokemons.slice(0, 6).forEach(pokemon => { // Show max 6 sprites
                const img = document.createElement('img');
                img.src = pokemon.sprite || 'static/assets/pokeball_icon.png';
                img.alt = pokemon.name || '';
                img.className = 'w-5 h-5';
                img.onerror = () => { img.src = 'static/assets/pokeball_icon.png'; }; // Fallback sprite
                spriteContainer.appendChild(img);
            });
            teamPreview.appendChild(spriteContainer);

            // --- Click Listener for Swapping Teams ---
            teamPreview.addEventListener('click', () => {
                const clickedIndex = parseInt(teamPreview.dataset.teamIndex, 10);

                // Update the main display with the clicked team
                currentMainTeamIndex = clickedIndex;
                updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]);

                // Re-render the "Other Teams" section to reflect the change
                updateOtherTeamsDisplay();

                // Optional: Scroll to the top of the sheet container
                teamSheetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            otherTeamsList.appendChild(teamPreview);
        });
    } else {
        // Hide the "Other Teams" section if no others exist (e.g., only 1 result total)
        otherTeamsContainer.classList.add('hidden');
        otherTeamsTitle.classList.add('hidden');
    }
}


// Renamed function to clarify its purpose (was displayTeam)
function displayTeamInGrid(team, container) {
    container.innerHTML = ''; // Clear previous content

    if (!team || !team.pokemons || team.pokemons.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Team data is empty or invalid.</div>`;
        return;
    }

    // 1. Create Header Row
    const headerRow = document.createElement('div');
    headerRow.className = 'excel-row header-row';
    headerRow.innerHTML = `
        <div class="excel-cell font-semibold">Sprite</div>
        <div class="excel-cell font-semibold">Pokémon</div>
        <div class="excel-cell font-semibold">Item</div>
        <div class="excel-cell font-semibold">Ability</div>
        <div class="excel-cell font-semibold">Tera Type</div>
        <div class="excel-cell font-semibold">Move 1</div>
        <div class="excel-cell font-semibold">Move 2</div>
        <div class="excel-cell font-semibold">Move 3</div>
        <div class="excel-cell font-semibold">Move 4</div>
    `;
    container.appendChild(headerRow);

    // 2. Create Data Rows for each Pokémon
    team.pokemons.forEach((pokemon, index) => {
        const row = document.createElement('div');
        const altClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:dark-row-alt';
        row.className = `excel-row ${altClass}`;

        const itemName = pokemon.item && pokemon.item !== "None" ? pokemon.item : null;
        const itemSpriteUrl = itemName
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName.toLowerCase().replace(/ /g, '-')}.png`
            : null;

        const teraType = pokemon.tera_type && pokemon.tera_type !== "None" ? pokemon.tera_type : "None";
        const teraClass = teraType !== "None" ? `type-${teraType.toLowerCase()}` : 'type-none';

        const moves = [...(pokemon.moves || [])];
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' });
        }

        let itemCellHTML = `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;
        if (itemName) {
            // Corrected fallback logic: The span should be visible *initially* and hidden by JS if the image loads.
            // But CSS approach is simpler: Show span only if img has error.
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${itemName}" class="w-4 h-4 mr-1 inline-block"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     title="${itemName}">
                <span class="item-fallback-text" style="display:none;">${itemName}</span>
            `;
             // If you suspect many items might fail loading, pre-render the text and hide image if it loads:
             /*
             itemCellHTML = `
                 <img src="${itemSpriteUrl}" alt="" class="w-4 h-4 mr-1 inline-block" style="display:none;"
                      onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                      onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" <!-- Keep error handler -->
                      title="${itemName}">
                 <span class="item-fallback-text">${itemName}</span>
             `;
             */
        }

        row.innerHTML = `
            <div class="excel-cell cell-sprite">
                <img src="${pokemon.sprite || 'static/assets/pokeball_icon.png'}" alt="${pokemon.name || 'Pokemon'}" class="w-8 h-8 mx-auto" onerror="this.onerror=null; this.src='static/assets/pokeball_icon.png';">
            </div>
            <div class="excel-cell font-medium cell-wrap">${pokemon.name || 'Unknown'}</div>
            <div class="excel-cell cell-item">${itemCellHTML}</div>
            <div class="excel-cell text-xs cell-wrap">${pokemon.ability || 'None'}</div>
            <div class="excel-cell cell-tera">
                ${teraType !== "None" ? `<span class="tera-badge-excel ${teraClass}">${teraType}</span>` : `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`}
            </div>
            ${moves.slice(0, 4).map(move => {
                const moveName = move?.name || '-';
                const moveType = move?.type?.toLowerCase() || 'unknown';
                return `
                <div class="excel-cell cell-move text-xs">
                    ${moveName !== '-' ? `
                        <span class="type-badge-excel type-${moveType} mr-1">${moveType.toUpperCase() || '?'}</span>
                        ${moveName}
                    ` : `
                        <span class="text-gray-400 dark:text-gray-500">-</span>
                    `}
                </div>
            `}).join("")}
        `;
        container.appendChild(row);
    });
}


// --- Utility Functions ---

// Function to copy the main team's Poképaste format to clipboard
function copyTeamToClipboard(team) {
    if (!team || !team.pokemons) return;

    const teamText = team.pokemons.map(pokemon => {
         const name = pokemon.name || "Unknown";
         const item = pokemon.item && pokemon.item !== "None" ? pokemon.item : "";
         const ability = pokemon.ability || "Unknown";
         const tera = pokemon.tera_type && pokemon.tera_type !== "None" ? `Tera Type: ${pokemon.tera_type}` : "";
         const moves = (pokemon.moves || [])
             .map(m => (m && m.name && m.name !== '-') ? `- ${m.name}` : null)
             .filter(m => m !== null)
             .join("\n");

        let pokemonString = `${name}${item ? ` @ ${item}` : ''}\n`;
        pokemonString += `Ability: ${ability}\n`;
        if (tera) pokemonString += `${tera}\n`;
        if (moves) pokemonString += `${moves}`;

        return pokemonString.trim();
    }).join("\n\n");

    navigator.clipboard.writeText(teamText).then(() => {
        const message = document.getElementById("global-copy-message");
        message.classList.add("visible");
        message.classList.remove("hidden");

        setTimeout(() => {
             message.classList.remove("visible");
        }, 2000);

    }).catch(err => {
        console.error('Failed to copy team:', err);
        alert("Failed to copy team to clipboard. Check browser permissions.");
    });
}