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
    'no', 'not', 'nor', 'or', 'but', 'so', 'if', 'then', 'than', 'without'
]);

// Levenshtein distance function for string similarity
function levenshteinDistance(a, b) {
    a = a.trim().toLowerCase();
    b = b.trim().toLowerCase();

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
                matrix[i - 1][j] + 1,       // Deletion
                matrix[i][j - 1] + 1,       // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }
    return matrix[a.length][b.length];
}


// Function to find the closest Pokémon name match for a given input word
function findClosestPokemonName(inputPhrase) {
    const inputLower = inputPhrase.trim().toLowerCase();

    // Added check for DataService readiness
    if (!inputLower || inputLower.length < 2 || inputLower.length > 30 || IGNORED_WORDS.has(inputLower) || !DataService.isInitialized) {
        return null;
    }

    // Get names directly from DataService
    const pokemonNamesArray = DataService.getAllPokemonNamesLower();

    if (pokemonNamesArray.length === 0) {
         console.warn("Pokémon names list not available for suggestions (DataService).");
         return null;
    }

    if (pokemonNamesArray.includes(inputLower)) {
        return null; // Already a perfect match
    }

    let closestMatch = null;
    // Adjust minDistance threshold based on input length? Shorter words need closer match.
    let minDistance = inputLower.length < 5 ? 3 : 5; // Allow only 1 change for short words, 2 for longer

    for (const name of pokemonNamesArray) {
        if (!name) continue;

        // Basic length filter
        if (Math.abs(name.length - inputLower.length) > minDistance + 1) {
            continue;
        }

        const distance = levenshteinDistance(inputLower, name);

        if (distance <= minDistance) {
            // If multiple matches have the same minimum distance, prefer the one closer in length?
            // Or just take the first one found.
            if (closestMatch === null || distance < minDistance ) {
                 minDistance = distance;
                 closestMatch = name;
            }
        }
    }

    // Get original casing if a match was found
    if (closestMatch) {
        const originalCaseName = DataService.getOriginalCaseName(closestMatch);
        // Ensure suggestion is actually different from input
        if (originalCaseName && originalCaseName.toLowerCase() !== inputPhrase.trim().toLowerCase()) {
            return originalCaseName;
        }
    }

    return null;
}

// Event listener for the instruction input field to trigger suggestions
document.getElementById("instruction").addEventListener("input", function() {
    const inputText = this.value;
    const cursorPosition = this.selectionStart; // Get cursor position
    const didYouMeanDiv = document.getElementById("did-you-mean");
    const suggestionLink = document.getElementById("suggestion-link");

    let start = inputText.lastIndexOf(' ', cursorPosition - 1) + 1;
    let end = inputText.indexOf(' ', cursorPosition);
    if (end === -1) {
        end = inputText.length;
    }

    // Extract the current phrase based on spaces
    const currentPhraseSpaced = inputText.substring(start, end).trim();

    // --- Attempt to detect hyphenated names being typed ---
    let potentialHyphenatedPhrase = currentPhraseSpaced;
    let actualStartForReplacement = start; // Keep track of the start index for replacement
    if (start > 0 && inputText[start - 1] === '-' && start > 1) {
        let prevWordStart = inputText.lastIndexOf(' ', start - 2) + 1;
        let potentialFirstPart = inputText.substring(prevWordStart, start - 1).trim();
        if (potentialFirstPart && !IGNORED_WORDS.has(potentialFirstPart.toLowerCase())) {
           potentialHyphenatedPhrase = potentialFirstPart + "-" + currentPhraseSpaced;
           actualStartForReplacement = prevWordStart; // Update start position for replacement
        }
    }

    let phraseToSuggestFor = potentialHyphenatedPhrase; // Default to potentially hyphenated
    let suggestedPokemon = findClosestPokemonName(phraseToSuggestFor);

    // If no suggestion for hyphenated, try just the part after the space/hyphen
    if (!suggestedPokemon && potentialHyphenatedPhrase !== currentPhraseSpaced) {
        phraseToSuggestFor = currentPhraseSpaced; // Fallback to space-separated part
        actualStartForReplacement = start; // Reset start position if we fell back
        suggestedPokemon = findClosestPokemonName(phraseToSuggestFor);
    }

    // --- Construct suggested text and display ---
    let suggestionText = null;
    if (suggestedPokemon && suggestedPokemon.toLowerCase() !== phraseToSuggestFor.toLowerCase()) {
        // Replace the identified phrase with the suggestion using actualStartForReplacement
        suggestionText = inputText.substring(0, actualStartForReplacement) + suggestedPokemon + inputText.substring(end);
    }


    // Show or hide the suggestion link
    if (suggestionText && suggestionText.toLowerCase() !== inputText.trim().toLowerCase()) {
        suggestionLink.textContent = `"${suggestionText}"`;
        suggestionLink.onclick = (e) => {
            e.preventDefault();
            const currentInput = document.getElementById("instruction");
            // const currentCursorPos = currentInput.selectionStart; // Less reliable after change
            const originalLength = inputText.length;

            currentInput.value = suggestionText + " "; // Add space after suggestion
            didYouMeanDiv.classList.add("hidden"); // Hide after clicking

            // Set cursor position reliably to the end of the inserted suggestion + space
            const newCursorPos = actualStartForReplacement + suggestedPokemon.length + 1;

            currentInput.focus();
             // Ensure cursor is within bounds and set position
            currentInput.setSelectionRange(
                 Math.max(0, Math.min(newCursorPos, currentInput.value.length)),
                 Math.max(0, Math.min(newCursorPos, currentInput.value.length))
             );

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
const unmetCriteriaDiv = document.getElementById("unmet-criteria-message"); // Get unmet criteria div
const unmetCriteriaListElem = unmetCriteriaDiv?.querySelector('ul'); // Find the ul inside it

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
    unmetCriteriaDiv.classList.add('hidden'); // Hide unmet criteria message
    if (unmetCriteriaListElem) unmetCriteriaListElem.innerHTML = ''; // Clear previous unmet list
    currentSearchResults = []; // Reset search results
    currentMainTeamIndex = -1; // Reset main team index

    // Simulate network delay/processing time (optional)
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        // Call the generation function from generate.js
        // Returns: [teams, noDetect, unmetCriteriaList, errorMessage]
        const [teams, noDetect, unmetCriteriaList, errorMsg] = await window.generatePokepaste(instruction);

        // Handle explicit errors first
        if (errorMsg) {
            throw new Error(errorMsg); // Propagate error to catch block
        }

        // Display unmet criteria message if any were found
        if (unmetCriteriaList && unmetCriteriaList.length > 0 && unmetCriteriaListElem) {
             unmetCriteriaListElem.innerHTML = unmetCriteriaList.map(item => `<li>${item}</li>`).join('');
             unmetCriteriaDiv.classList.remove('hidden');
        }


        if ((!teams || teams.length === 0)) {
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query${unmetCriteriaList?.length > 0 ? ' based on the remaining criteria' : ''}. Try different keywords or check the format help (?).</div>`;
            otherTeamsContainer.classList.add('hidden'); // Hide other teams section
             // Keep the unmet criteria message visible if it was populated
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

             // Adjust message if the main result was random due to no detection (Not currently implemented in generate.js, but could be)
             // if (noDetect && mainTeam) { ... }
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">Sorry, something went wrong during the search. Please try again later.<br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
         unmetCriteriaDiv.classList.add('hidden'); // Hide unmet on error too
         if (unmetCriteriaListElem) unmetCriteriaListElem.innerHTML = '';
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
                 if (!pokemon) return; // Skip if pokemon data is null/invalid
                const img = document.createElement('img');
                img.src = pokemon.sprite || 'static/assets/pokeball_icon.png';
                img.alt = pokemon.name || '';
                img.className = 'w-5 h-5 object-contain'; // Use object-contain
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
         if (!pokemon) return; // Skip if pokemon data is missing in the array

        const row = document.createElement('div');
        // Adjusted dark mode alt row color class name
        const altClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-excel-dark-alt';
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
            // Fallback logic: Display text if image fails to load.
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${itemName}" class="w-4 h-4 mr-1 inline-block object-contain"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                     title="${itemName}">
                <span class="item-fallback-text" style="display:none;">${itemName}</span>
            `;
        }

        row.innerHTML = `
            <div class="excel-cell cell-sprite">
                <img src="${pokemon.sprite || 'static/assets/pokeball_icon.png'}" alt="${pokemon.name || 'Pokemon'}" class="w-8 h-8 mx-auto object-contain" onerror="this.onerror=null; this.src='static/assets/pokeball_icon.png';">
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
                 // Capitalize first letter of type for badge
                 const displayType = moveType.charAt(0).toUpperCase() + moveType.slice(1);
                return `
                <div class="excel-cell cell-move text-xs">
                    ${moveName !== '-' ? `
                        <span class="type-badge-excel type-${moveType} mr-1" title="${displayType} Type">${moveType.toUpperCase() || '?'}</span>
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
        if (!pokemon) return ""; // Handle potential null pokemon in array

         const name = pokemon.name || "Unknown";
         // Ensure item/ability/tera aren't added if null or 'None'
         const item = pokemon.item && pokemon.item !== "None" ? ` @ ${pokemon.item}` : "";
         const ability = pokemon.ability && pokemon.ability !== "None" ? `Ability: ${pokemon.ability}` : "";
         const tera = pokemon.tera_type && pokemon.tera_type !== "None" ? `Tera Type: ${pokemon.tera_type}` : "";

         const moves = (pokemon.moves || [])
             .map(m => (m && m.name && m.name !== '-') ? `- ${m.name}` : null)
             .filter(m => m !== null); // Filter out nulls before joining

        let pokemonString = `${name}${item}\n`;
        if (ability) pokemonString += `${ability}\n`;
        // Add EVs/IVs/Nature here if they exist in the data and are desired
        // pokemonString += `EVs: ...\n`;
        // pokemonString += `IVs: ...\n`;
        if (tera) pokemonString += `${tera}\n`;
        if (moves.length > 0) pokemonString += `${moves.join("\n")}`;

        return pokemonString.trim(); // Trim whitespace from each entry
    }).filter(Boolean).join("\n\n"); // Filter out empty strings before final join

    navigator.clipboard.writeText(teamText).then(() => {
        const message = document.getElementById("global-copy-message");
        message.classList.add("visible");
        // message.classList.remove("hidden"); // visible class handles opacity/transform

        // Clear previous timeouts if any
        if (message.timeoutId) clearTimeout(message.timeoutId);

        message.timeoutId = setTimeout(() => {
             message.classList.remove("visible");
             message.timeoutId = null; // Clear the stored timeout ID
        }, 2000);

    }).catch(err => {
        console.error('Failed to copy team:', err);
        alert("Failed to copy team to clipboard. Check browser permissions.");
    });
}