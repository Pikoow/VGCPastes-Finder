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
    formatHelp.classList.toggle("hidden");
    // Optional: Add animation if desired
    // formatHelp.classList.toggle("animate-fade-in");
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

    // Ensure pokemonNames list is available
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
    let minDistance = 3; // Maximum allowed distance for a suggestion (adjust as needed)

    for (const name of pokemonNamesArray) {
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
        const originalCaseName = data.flatMap(t => t.pokemons).find(p => p.name.toLowerCase() === closestMatch)?.name || closestMatch;
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
    const words = inputText.trim().split(/\s+/);
    const lastWord = words[words.length - 1];

    let suggestion = null;
    let suggestedPokemon = findClosestPokemonName(lastWord);

    if (suggestedPokemon) {
        // Construct the suggested text by replacing the last word
        words[words.length - 1] = suggestedPokemon;
        suggestion = words.join(" ");
    }

    // Show or hide the suggestion link
    if (suggestion && suggestion.toLowerCase() !== inputText.trim().toLowerCase()) {
        suggestionLink.textContent = `"${suggestion}"`;
        suggestionLink.onclick = (e) => {
            e.preventDefault();
            document.getElementById("instruction").value = suggestion;
            didYouMeanDiv.classList.add("hidden"); // Hide after clicking
            triggerSearch(); // Optionally trigger search immediately
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
const teamHeader = document.getElementById("team-header");
const teamTitle = document.getElementById("team-title");
const copyAllBtn = document.getElementById("copy-all-btn");
const otherTeamsContainer = document.getElementById("other-teams-container");
const otherTeamsTitle = document.getElementById("other-teams-title");
const otherTeamsList = document.getElementById("other-teams-list");
const searchText = document.getElementById("search-text");
const loadingSpinner = document.getElementById("loading-spinner");

// Function to trigger the search process
async function triggerSearch() {
    const instruction = instructionInput.value.trim();
    if (!instruction) return; // Don't search if input is empty

    // --- UI Updates: Start Loading ---
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true; // Disable button during search
    teamContainer.innerHTML = ''; // Clear previous results
    teamTitle.textContent = 'Loading Team...';
    copyAllBtn.classList.add('hidden');
    otherTeamsTitle.classList.add('hidden');
    otherTeamsList.innerHTML = '';
    document.getElementById("did-you-mean").classList.add("hidden"); // Hide suggestion

    // Simulate network delay/processing time (optional)
    // await new Promise(resolve => setTimeout(resolve, 300));

    try {
        // Call the generation function from generate.js
        const [teams, noDetect] = window.generatePokepaste(instruction);

        if (noDetect && (!teams || teams.length === 0)) {
             // Handle case where generatePokepaste returns truly empty
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try different keywords.</div>`;
            otherTeamsContainer.classList.add('hidden'); // Hide other teams section

        } else if (teams && teams.length > 0) {
            // We have at least one team (either matched or random)
            const mainTeam = teams[0];

             // Update main team title and display
            teamTitle.textContent = mainTeam.filename.split('.')[0].replace(/_/g, ' '); // Clean up filename
            displayTeam(mainTeam, teamContainer); // Display the main team using the new function
            copyAllBtn.classList.remove('hidden'); // Show copy button

            // Setup copy button functionality
            copyAllBtn.onclick = () => copyTeamToClipboard(mainTeam);

            // Handle "other" teams (if more than one team was returned)
            if (teams.length > 1) {
                otherTeamsContainer.classList.remove('hidden');
                 otherTeamsTitle.textContent = `${teams.length - 1} other potential match${teams.length > 2 ? 'es' : ''}:`;
                 otherTeamsTitle.classList.remove('hidden');
                displayOtherTeams(teams.slice(1), otherTeamsList); // Display previews
            } else {
                 otherTeamsContainer.classList.add('hidden'); // Hide if only one team
            }

             if (noDetect) {
                 // If noDetect is true, it means the main team is random
                 otherTeamsContainer.classList.remove('hidden');
                 otherTeamsTitle.textContent = `No exact matches found. Showing a random team:`;
                 otherTeamsTitle.classList.remove('hidden');
                 otherTeamsList.innerHTML = ''; // No "other" teams in this case
             }

        } else {
             // Should not happen if generatePokepaste guarantees an array, but handle defensively
            teamTitle.textContent = 'Error';
             teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">An unexpected error occurred. Please try again.</div>`;
             otherTeamsContainer.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">Sorry, something went wrong during the search. Error: ${error.message}</div>`;
        copyAllBtn.classList.add('hidden');
         otherTeamsContainer.classList.add('hidden');
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

// Function to display the main team in a table/grid format
function displayTeam(team, container) {
    container.innerHTML = ''; // Clear previous content

    // 1. Create Header Row
    const headerRow = document.createElement('div');
    headerRow.className = 'excel-row header-row sticky top-0 bg-gray-200 dark:bg-gray-700 z-10'; // Sticky header
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
        // Add alternating row colors
        row.className = `excel-row ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-850'}`;

        const itemSpriteUrl = pokemon.item && pokemon.item !== "None"
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${pokemon.item.toLowerCase().replace(/ /g, '-')}.png`
            : 'static/assets/no_item.png'; // Path to a placeholder "no item" image

        const teraType = pokemon.tera_type || "None";
        const teraClass = teraType !== "None" ? `type-${teraType.toLowerCase()}` : 'type-none';

        // Ensure moves array has 4 elements (pad with placeholders if necessary)
        const moves = [...pokemon.moves];
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' });
        }

        row.innerHTML = `
            <div class="excel-cell cell-sprite">
                <img src="${pokemon.sprite || 'static/assets/pokeball_icon.png'}" alt="${pokemon.name}" class="w-8 h-8 mx-auto" onerror="this.onerror=null; this.src='static/assets/pokeball_icon.png';">
            </div>
            <div class="excel-cell font-medium">${pokemon.name}</div>
            <div class="excel-cell cell-item">
                ${pokemon.item !== "None" ? `
                    <img src="${itemSpriteUrl}" alt="${pokemon.item}" class="w-4 h-4 mr-1 inline-block" onerror="this.style.display='none'; this.nextSibling.style.display='inline';" title="${pokemon.item}">
                    <span style="display:none;">${pokemon.item}</span> <!-- Fallback text if image fails -->
                 ` : `
                     <span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>
                 `}
            </div>
            <div class="excel-cell text-xs">${pokemon.ability}</div>
             <div class="excel-cell cell-tera">
                ${teraType !== "None" ? `<span class="tera-badge-excel ${teraClass}">${teraType}</span>` : `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`}
            </div>
            ${moves.map(move => `
                <div class="excel-cell cell-move text-xs">
                    ${move.name !== '-' ? `
                        <span class="type-badge-excel type-${move.type?.toLowerCase() || 'unknown'} mr-1">${move.type?.toUpperCase() || '?'}</span>
                        ${move.name}
                    ` : `
                        <span class="text-gray-400 dark:text-gray-500">-</span>
                    `}
                </div>
            `).join("")}
        `;
        container.appendChild(row);
    });
}

// Function to display previews of other matching teams
function displayOtherTeams(teams, listContainer) {
    listContainer.innerHTML = ''; // Clear previous list
    teams.forEach(team => {
        const teamPreview = document.createElement('div');
        teamPreview.className = 'other-team-preview border border-gray-300 dark:border-gray-600 p-1.5 rounded-sm bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors';
        teamPreview.title = `Click to view team: ${team.filename.split('.')[0].replace(/_/g, ' ')}\nScore: ${team.score}`; // Tooltip

        const teamName = document.createElement('div');
        teamName.className = 'text-xs font-semibold truncate mb-1 text-gray-700 dark:text-gray-200';
        teamName.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
        teamPreview.appendChild(teamName);

        const spriteContainer = document.createElement('div');
        spriteContainer.className = 'flex flex-wrap gap-1 justify-center';
        team.pokemons.slice(0, 6).forEach(pokemon => { // Show max 6 sprites
            const img = document.createElement('img');
            img.src = pokemon.sprite || 'static/assets/pokeball_icon.png';
            img.alt = pokemon.name;
            img.className = 'w-5 h-5';
             img.onerror = () => { img.src = 'static/assets/pokeball_icon.png'; }; // Fallback sprite
            spriteContainer.appendChild(img);
        });
        teamPreview.appendChild(spriteContainer);

        // Add click listener to load this team as the main one
        teamPreview.addEventListener('click', () => {
             // Find the full team data (assuming 'teams' includes the main team already filtered out)
             // We might need to fetch the full data again or pass it differently if not available here.
             // For simplicity, let's re-run the search focused on this team's name if possible,
             // or just display the preview data in the main area.
             // Let's just display this team in the main view for now.
            teamTitle.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
            displayTeam(team, teamContainer);
            copyAllBtn.classList.remove('hidden');
            copyAllBtn.onclick = () => copyTeamToClipboard(team);
             // Optionally scroll to top
             window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        listContainer.appendChild(teamPreview);
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
         // Format moves, ensuring they exist and handling missing ones gracefully
         const moves = (pokemon.moves || [])
             .map(m => m && m.name && m.name !== '-' ? `- ${m.name}` : null) // Get only valid move names
             .filter(m => m !== null) // Remove null entries
             .join("\n");

        // Construct the string for one Pokémon
        let pokemonString = `${name}${item ? ` @ ${item}` : ''}\n`;
        pokemonString += `Ability: ${ability}\n`;
        if (tera) pokemonString += `${tera}\n`;
        // Add EVs/IVs/Nature placeholder if you have that data eventually
        // pokemonString += `EVs: ... \n`;
        // pokemonString += `IVs: ... \n`;
        // pokemonString += `Nature ... \n`;
        if (moves) pokemonString += `${moves}`; // Add moves if they exist

        return pokemonString.trim(); // Trim whitespace from each Pokémon block
    }).join("\n\n"); // Join Pokémon blocks with double newline

    navigator.clipboard.writeText(teamText).then(() => {
        // Show confirmation message
        const message = document.getElementById("global-copy-message");
        message.classList.remove("hidden");
        // Add class to trigger animation/transition (if defined in CSS)
        message.style.transform = 'translateX(-50%) translateY(0)';
        message.style.opacity = '1';

        // Hide the message after a delay
        setTimeout(() => {
             message.style.transform = 'translateX(-50%) translateY(-150%)';
             message.style.opacity = '0';
             // Optionally use transitionend event for smoother hiding if using CSS transitions
             setTimeout(() => message.classList.add("hidden"), 300); // Hide after transition
        }, 2000); // Display duration: 2 seconds

    }).catch(err => {
        console.error('Failed to copy team:', err);
        alert("Failed to copy team to clipboard."); // Simple fallback alert
    });
}

// Helper function to shuffle an array (used previously, might be useful again)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}