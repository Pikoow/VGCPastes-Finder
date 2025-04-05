// --- Theme Toggle ---
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");

function applyTheme(isDarkMode) {
    if (isDarkMode) {
        document.documentElement.classList.add("dark");
        themeIcon.textContent = "☀️";
        localStorage.theme = "dark";
    } else {
        document.documentElement.classList.remove("dark");
        themeIcon.textContent = "🌙";
        localStorage.theme = "light";
    }
}

themeToggle.addEventListener("click", () => {
    const isDarkMode = !document.documentElement.classList.contains("dark");
    applyTheme(isDarkMode);
});

// Apply theme on initial load based on preference/localStorage
applyTheme(localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches));

// --- Query Builder UI ---
const addCriteriaBtn = document.getElementById('add-criteria-btn');
const addCriteriaMenu = document.getElementById('add-criteria-menu');
const criteriaContainer = document.getElementById('criteria-container');
const criteriaTemplates = document.getElementById('criteria-templates');
const deleteAllCriteriaBtn = document.getElementById('delete-all-criteria-btn');
const initialMessage = document.getElementById("initial-message");

let isDataReady = false; // Flag to track if DataService is initialized

// --- Populate Select Options ---
function populateSelectWithOptions(selectElement, optionsData, placeholder, addAnyOption = true, anyOptionText = null) {
    selectElement.innerHTML = ''; // Clear existing options
    const currentVal = selectElement.value; // Store current value

    // Add placeholder option
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = "";
    placeholderOpt.textContent = placeholder;
    placeholderOpt.disabled = true; // Always disable placeholder
    placeholderOpt.selected = !currentVal; // Select placeholder initially if no value
    selectElement.appendChild(placeholderOpt);

    // Add 'Any' option if requested
    const isPrimarySelector = selectElement.dataset.field === 'pokemonName' || selectElement.dataset.field === 'value';
    if (addAnyOption && !isPrimarySelector) {
        const anyOpt = document.createElement('option');
        anyOpt.value = ""; // Represents 'Any'
        if (anyOptionText) {
            anyOpt.textContent = anyOptionText;
        } else {
            let fieldName = selectElement.dataset.field || 'value';
            fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1'); // Format field name
            anyOpt.textContent = `Any ${fieldName}`;
        }
        selectElement.appendChild(anyOpt);
        // If 'Any' is added and no value was previously selected, select 'Any' instead of placeholder
        if (!currentVal) {
            placeholderOpt.selected = false;
            anyOpt.selected = true;
        }
    }

    // Add actual options from the pre-sorted, pre-formatted data
    optionsData.forEach(optionData => {
        if (!optionData || !optionData.key) return; // Skip invalid data
        const option = document.createElement('option');
        option.value = optionData.key; // Use the lowercase key
        option.textContent = optionData.display; // Use the pre-formatted text with count
        selectElement.appendChild(option);

        // Reselect previous value if it exists in the new options
        if (currentVal && optionData.key === currentVal) {
            option.selected = true;
            placeholderOpt.selected = false; // Ensure placeholder isn't selected
            const anyOpt = selectElement.querySelector('option[value=""]:not([disabled])');
            if (anyOpt) anyOpt.selected = false;
        }
    });

     // Final check: if no option ended up selected (e.g., previous value removed), select 'Any' or placeholder
     if (!selectElement.querySelector('option[selected]')) {
         const anyOption = selectElement.querySelector('option[value=""]:not([disabled])'); // Find non-disabled "Any"
         if (anyOption) {
             anyOption.selected = true;
             placeholderOpt.selected = false;
         } else {
             placeholderOpt.selected = true; // Fallback to placeholder if 'Any' not applicable/present
         }
     }
}

function updateDeleteAllButtonVisibility() {
    if (criteriaContainer.children.length > 0) {
        deleteAllCriteriaBtn.classList.remove('hidden');
        if (initialMessage) initialMessage.classList.add('hidden'); // Hide initial message if criteria exist
    } else {
        deleteAllCriteriaBtn.classList.add('hidden');
        if (initialMessage) initialMessage.classList.remove('hidden'); // Show initial message if empty
    }
}

// Function to set up all selects once data is ready
function initializeSelects() {
    if (!isDataReady) {
        console.warn("Data not ready, cannot initialize selects yet.");
        return;
    }
    console.log("Initializing select options with counts...");

    // Get template selects
    const pokemonTemplate = criteriaTemplates.querySelector('.pokemon-block');
    const generalTemplate = criteriaTemplates.querySelector('.general-block');

    // --- Populate Pokémon template selects (using new sorted data methods) ---
    // Pokemon Name
    populateSelectWithOptions(pokemonTemplate.querySelector('.pokemon-select'), DataService.getPokemonSortedByCount(), '-- Select Pokémon --', false); // No 'Any' for primary Pokemon select

    // Item (Sorted by count)
    populateSelectWithOptions(pokemonTemplate.querySelector('.item-select'), DataService.getItemsSortedByCount(), '-- Any Item --', true);

    // Ability (Initially populate with ALL abilities sorted by count, will be filtered on Pokemon selection)
    populateSelectWithOptions(pokemonTemplate.querySelector('.ability-select'), DataService.getAbilitiesSortedByCount(), '-- Any Ability --', true);

    // Tera (Use alphabetical static list for now, or implement tera counting if needed)
    // Let's keep Tera alphabetical for simplicity, as counts might not be that informative here.
    populateSelectWithOptions(
        pokemonTemplate.querySelector('.tera-select'),
        DataService.getAllTeraTypesLower().map(t => ({ key: t, display: t.charAt(0).toUpperCase() + t.slice(1) })), // Format for consistency
        '-- Any Tera Type --',
        true
    );

    // Moves (Initially populate with ALL moves sorted by count, will be filtered on Pokemon selection)
    const moveSelects = pokemonTemplate.querySelectorAll('.move-select');
    moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesSortedByCount(), '-- Any Move --', true));

    // Store options for general templates (use sorted data methods)
    generalSelectOptions = {
         item: DataService.getItemsSortedByCount(),
         ability: DataService.getAbilitiesSortedByCount(),
         move: DataService.getMovesSortedByCount(),
         // Use alphabetical for Tera/Role unless counts are desired
         tera: DataService.getAllTeraTypesLower().map(t => ({ key: t, display: t.charAt(0).toUpperCase() + t.slice(1) })),
         role: DataService.getAllRolesLower().map(r => ({ key: r, display: r.charAt(0).toUpperCase() + r.slice(1) })),
    };

    console.log("Select options initialized.");
    addCriteriaBtn.disabled = false; // Enable Add button
    addCriteriaBtn.title = "Add criteria to search for";
}

// Store options globally for easy access when creating general blocks
let generalSelectOptions = {};

// Listen for the 'dataReady' event from generate.js
document.addEventListener('dataReady', () => {
    isDataReady = true;
    initializeSelects(); // Populate selects now that data is available
});

// Disable Add button initially until data is ready
addCriteriaBtn.disabled = true;
addCriteriaBtn.title = "Loading data...";


// --- Add/Remove Criteria Logic ---

// Show/Hide Add Criteria Menu
addCriteriaBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent click from immediately propagating to document listener
    if (!addCriteriaBtn.disabled) { // Only toggle if not disabled
        addCriteriaMenu.classList.toggle('hidden');
    }
});

// Hide menu when clicking outside
document.addEventListener('click', (e) => {
    // Check if the click is outside the button AND outside the menu
    if (!addCriteriaBtn.contains(e.target) && !addCriteriaMenu.contains(e.target)) {
        addCriteriaMenu.classList.add('hidden');
    }
});

// Handle adding a criterion when a menu item is clicked
addCriteriaMenu.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering document listener
    const target = e.target.closest('.criteria-menu-item');
    if (target && target.dataset.type) {
        addCriteriaBlock(target.dataset.type);
        addCriteriaMenu.classList.add('hidden'); // Hide menu after selection
    }
});

// Function to add a new criteria block to the container
function addCriteriaBlock(type) {
    let template;
    let newBlock;

    if (!isDataReady) {
        console.error("Cannot add criteria: Data is not ready yet.");
        // Optionally show a user message here
        return;
    }

    if (type === 'pokemon') {
        template = criteriaTemplates.querySelector('.pokemon-block');
        newBlock = template.cloneNode(true);
        // The template is already populated correctly by initializeSelects
        // We might need to re-run populate on clone if deep clone doesn't copy options correctly in all browsers, but usually does.
        // Let's assume clone works for now. If dropdowns are empty, uncomment below:
        // initializePokemonBlockSelects(newBlock); // You'd need to create this helper function
    } else { // General types (item, ability, move, tera, role)
        template = criteriaTemplates.querySelector('.general-block');
        newBlock = template.cloneNode(true);
        newBlock.dataset.type = type; // Set specific type for the block

        const label = newBlock.querySelector('.criteria-label');
        const select = newBlock.querySelector('.value-select');
        const options = generalSelectOptions[type] || []; // Get pre-sorted options
        const placeholder = `-- Select ${type.charAt(0).toUpperCase() + type.slice(1)} --`;

        label.textContent = `General ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        // Populate the general select
        // For general blocks, the placeholder IS the 'Any' selection (value="")
        populateSelectWithOptions(select, options, placeholder, false); // addAnyOption = false

        newBlock.querySelector('.remove-criteria-btn').title = `Remove ${type} criterion`;
    }

    // Add remove functionality AFTER cloning and populating
    const removeBtn = newBlock.querySelector('.remove-criteria-btn');
    removeBtn.addEventListener('click', () => {
        newBlock.remove();
        updateDeleteAllButtonVisibility(); // Check if container is now empty
    });

    criteriaContainer.appendChild(newBlock);
    updateDeleteAllButtonVisibility(); // Ensure button visibility is correct
}

// --- Event Listener for Pokémon Selection Change ---
criteriaContainer.addEventListener('change', (event) => {
    // Check if the changed element is a pokemon-select inside a pokemon-block
    if (event.target.classList.contains('pokemon-select') && event.target.closest('.pokemon-block')) {
        const pokemonBlock = event.target.closest('.pokemon-block');
        const selectedPokemonNameLower = event.target.value; // This is the lowercase key

        const abilitySelect = pokemonBlock.querySelector('.ability-select');
        const moveSelects = pokemonBlock.querySelectorAll('.move-select');

        if (!selectedPokemonNameLower) {
            // If "-- Select Pokémon --" is chosen, repopulate with ALL abilities/moves sorted by count
            if (abilitySelect) populateSelectWithOptions(abilitySelect, DataService.getAbilitiesSortedByCount(), '-- Any Ability --', true);
            moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesSortedByCount(), '-- Any Move --', true));
        } else {
            // Fetch and populate specific abilities, sorted by global count
            const abilities = DataService.getAbilitiesForPokemonSorted(selectedPokemonNameLower);
            if (abilitySelect) populateSelectWithOptions(abilitySelect, abilities, '-- Any Ability --', true);

            // Fetch and populate specific moves, sorted by global count
            const moves = DataService.getMovesForPokemonSorted(selectedPokemonNameLower);
            moveSelects.forEach(select => populateSelectWithOptions(select, moves, '-- Any Move --', true));
        }
    }
});

// --- Event Listener for Delete All Button ---
deleteAllCriteriaBtn.addEventListener('click', () => {
    // Optional confirmation dialog
    if (confirm('Are you sure you want to remove all criteria?')) {
        criteriaContainer.innerHTML = ''; // Clear the container
        updateDeleteAllButtonVisibility(); // Hide the button and potentially show initial message
    }
});


// --- Search Functionality ---
const searchBtn = document.getElementById("search-btn");
const teamContainer = document.getElementById("team-container");
const teamSheetContainer = document.getElementById("team-sheet-container");
const teamHeader = document.getElementById("team-header");
const teamTitle = document.getElementById("team-title");
const copyAllBtn = document.getElementById("copy-all-btn");
const otherTeamsContainer = document.getElementById("other-teams-container");
const otherTeamsTitle = document.getElementById("other-teams-title");
const otherTeamsList = document.getElementById("other-teams-list");
const searchText = document.getElementById("search-text");
const loadingSpinner = document.getElementById("loading-spinner");

let currentSearchResults = []; // Stores the raw team data from the last search
let currentMainTeamIndex = -1; // Index in currentSearchResults for the main display

// Function to gather the structured query from the UI
function buildQueryFromUI() {
    const criteria = [];
    const blocks = criteriaContainer.querySelectorAll('.criteria-block');

    blocks.forEach(block => {
        const type = block.dataset.type;
        const criterion = { type };

        if (type === 'pokemon') {
            // Pokemon name is essential for this type
            const pokemonName = block.querySelector('.pokemon-select').value; // lowercase key
            if (pokemonName) {
                 criterion.pokemonName = pokemonName;
                 // Get values from sub-selects, empty string "" means 'Any' / not specified
                 criterion.item = block.querySelector('.item-select').value || null;
                 criterion.ability = block.querySelector('.ability-select').value || null;
                 criterion.tera = block.querySelector('.tera-select').value || null;
                 criterion.move1 = block.querySelector('[data-field="move1"]').value || null;
                 criterion.move2 = block.querySelector('[data-field="move2"]').value || null;
                 criterion.move3 = block.querySelector('[data-field="move3"]').value || null;
                 criterion.move4 = block.querySelector('[data-field="move4"]').value || null;
                 // Only add criterion if a pokemon is actually selected
                 criteria.push(criterion);
            }
        } else { // General criteria (item, ability, move, tera, role)
            const value = block.querySelector('.value-select').value; // lowercase key
            if (value) { // Only add if a specific value is selected (not the placeholder)
                criterion.value = value;
                criteria.push(criterion);
            }
        }
    });
    console.log("Built Query:", criteria); // Log the built query for debugging
    return criteria;
}


// Function to trigger the search process
async function triggerSearch() {
    const queryCriteria = buildQueryFromUI();

    // If no valid criteria were added, show a message and stop
    if (queryCriteria.length === 0) {
        teamTitle.textContent = 'Build a Query';
        teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Add criteria using the button above to start searching for teams. Select a Pokémon or a general item/ability/move/tera/role.</div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        if (initialMessage) initialMessage.classList.remove('hidden'); // Ensure initial message is visible
        return;
    }

    // --- UI updates for loading state ---
    if (initialMessage) initialMessage.classList.add('hidden'); // Hide initial message during search
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true;
    addCriteriaBtn.disabled = true; // Disable adding more criteria during search
    deleteAllCriteriaBtn.disabled = true; // Disable clearing during search

    // Clear previous results visually
    teamContainer.innerHTML = ''; // Clear main team grid
    teamTitle.textContent = 'Loading Team...';
    copyAllBtn.classList.add('hidden');
    otherTeamsContainer.classList.add('hidden');
    otherTeamsTitle.classList.add('hidden');
    otherTeamsList.innerHTML = '';

    // Reset internal state
    currentSearchResults = [];
    currentMainTeamIndex = -1;

    console.log("Starting search with criteria:", queryCriteria);
    // Brief pause allows UI to update before potentially blocking work
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        // Call the generator function (from generate.js)
        const teams = await window.generatePokepaste(queryCriteria);

        if (!teams || teams.length === 0) {
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try adjusting the criteria.</div>`;
            otherTeamsContainer.classList.add('hidden'); // Ensure other teams is hidden
        } else {
             currentSearchResults = teams; // Store results
             currentMainTeamIndex = 0; // Display the first best match initially
             updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]); // Update main display

             // If there are more teams than the one displayed, show the 'other matches' section
             if (currentSearchResults.length > 1) {
                updateOtherTeamsDisplay();
             } else {
                otherTeamsContainer.classList.add('hidden'); // Hide if only one match
             }
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">An error occurred during the search. Please check the console for details. <br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        // Reset state on error
        currentSearchResults = [];
        currentMainTeamIndex = -1;
    } finally {
        // --- Restore UI after search completes (success or error) ---
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
        searchBtn.disabled = false;
        // Only re-enable Add button if data is ready
        addCriteriaBtn.disabled = !isDataReady;
        deleteAllCriteriaBtn.disabled = false; // Re-enable clear button
    }
}

// Event listener for the search button
searchBtn.addEventListener("click", triggerSearch);

// --- Display Functions ---

function updateMainTeamDisplay(team) {
    if (!team) {
        console.error("updateMainTeamDisplay called with invalid team data");
        teamTitle.textContent = 'Error Loading Team';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">Could not display team data.</div>`;
        copyAllBtn.classList.add('hidden');
        return;
    }
    // Clean up filename for display
    teamTitle.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
    displayTeamInGrid(team, teamContainer); // Render the grid
    copyAllBtn.classList.remove('hidden'); // Show copy button
    // Update the copy button's click handler to use the currently displayed team
    copyAllBtn.onclick = () => copyTeamToClipboard(team);
}

function updateOtherTeamsDisplay() {
    otherTeamsList.innerHTML = ''; // Clear previous previews
    // Get all teams *except* the one currently in the main display
    const otherTeams = currentSearchResults.filter((_, index) => index !== currentMainTeamIndex);

    if (otherTeams.length > 0) {
        otherTeamsContainer.classList.remove('hidden'); // Show the container
        otherTeamsTitle.textContent = `${otherTeams.length} other potential match${otherTeams.length > 1 ? 'es' : ''}:`;
        otherTeamsTitle.classList.remove('hidden'); // Show the title

        // Create previews for *all* teams in the results, highlighting the current one maybe? No, just list others.
        currentSearchResults.forEach((team, index) => {
            if (index === currentMainTeamIndex) return; // Skip the one already displayed

            const teamPreview = document.createElement('div');
            // Add Tailwind classes for styling and make it interactive
            teamPreview.className = 'other-team-preview border p-1.5 rounded-sm cursor-pointer transition-colors duration-150 ease-in-out bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600';
            teamPreview.title = `Click to view: ${team.filename.split('.')[0].replace(/_/g, ' ')}`;
            teamPreview.dataset.teamIndex = index; // Store the index to load it later

            // Team Name Preview
            const teamName = document.createElement('div');
            teamName.className = 'text-xs font-semibold truncate mb-1 team-name-preview text-gray-700 dark:text-gray-300';
            teamName.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
            teamPreview.appendChild(teamName);

            // Sprite Preview Container
            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'flex flex-wrap gap-1 justify-center items-center'; // Center sprites
            // Show first 6 pokemon sprites (or fewer if team has less)
            team.pokemons.slice(0, 6).forEach(pokemon => {
                 if (!pokemon) return; // Skip if pokemon data is null in the array
                const img = document.createElement('img');
                img.src = pokemon.sprite || 'static/assets/pokeball_icon.png'; // Use pokeball as fallback
                img.alt = pokemon.name || ''; // Alt text
                img.className = 'w-5 h-5 object-contain inline-block'; // Small sprites
                // Basic error handling for broken sprite links
                img.onerror = () => { img.src = 'static/assets/pokeball_icon.png'; };
                spriteContainer.appendChild(img);
            });
            teamPreview.appendChild(spriteContainer);

            // Click listener to switch the main display
            teamPreview.addEventListener('click', () => {
                const clickedIndex = parseInt(teamPreview.dataset.teamIndex, 10);
                if (!isNaN(clickedIndex) && clickedIndex < currentSearchResults.length) {
                    currentMainTeamIndex = clickedIndex; // Update the main index
                    updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]); // Update main display
                    updateOtherTeamsDisplay(); // Re-render the 'other teams' list (to remove the one just clicked)
                    // Scroll the main team sheet into view smoothly
                    teamSheetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.error("Invalid team index clicked:", teamPreview.dataset.teamIndex);
                }
            });

            otherTeamsList.appendChild(teamPreview); // Add the preview to the list
        });
    } else {
        // Hide the section if no other teams are left
        otherTeamsContainer.classList.add('hidden');
        otherTeamsTitle.classList.add('hidden');
    }
}


// Function to display team details in the grid (Excel-like)
function displayTeamInGrid(team, container) {
    container.innerHTML = ''; // Clear previous content

    // Handle cases where team data might be missing or invalid
    if (!team || !team.pokemons || team.pokemons.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Team data is empty or invalid.</div>`;
        return;
    }

    // Create Header Row
    const headerRow = document.createElement('div');
    headerRow.className = 'excel-row header-row'; // Sticky header styles from CSS
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

    // Create Data Rows for each Pokémon
    team.pokemons.forEach((pokemon, index) => {
        if (!pokemon) return; // Skip if pokemon data is somehow null in the array

        const row = document.createElement('div');
        // Apply alternating background colors based on index and theme
        const isDarkMode = document.documentElement.classList.contains('dark');
        const altClass = index % 2 === 0
            ? (isDarkMode ? 'dark:bg-gray-800' : 'bg-white') // Even rows
            : (isDarkMode ? 'dark:bg-excel-dark-alt' : 'bg-gray-50'); // Odd rows (using custom dark alt)
        row.className = `excel-row ${altClass}`; // Basic row structure + alternating color


        // Prepare data points with fallbacks
        const itemName = pokemon.item; // Already processed to be null if "None" or missing in simplifyData
        const itemSpriteUrl = itemName
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName.toLowerCase().replace(/ /g, '-')}.png`
            : null;
        const teraType = pokemon.tera_type; // Already processed to be null if invalid/missing
        const teraClass = teraType ? `type-${teraType.toLowerCase()}` : 'type-none'; // CSS class for badge color

        // Ensure moves array exists and pad with placeholders if necessary for display consistency
        const moves = [...(pokemon.moves || [])]; // Copy moves array or start with empty
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' }); // Add placeholder move objects
        }

        // --- Generate HTML for complex cells ---

        // Item Cell: Display image with text fallback
        let itemCellHTML = `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`; // Default for no item
        if (itemName) {
            // Basic sanitization for alt/title attributes to prevent HTML injection issues
            const safeItemName = itemName.replace(/"/g, '"').replace(/'/g, '"');
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${safeItemName}" class="w-4 h-4 mr-1 inline-block object-contain"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                     title="${safeItemName}">
                <span class="item-fallback-text" style="display:none;">${itemName /* Use original case */}</span>
            `;
        }

        // Tera Cell: Display badge or "None"
        const teraCellHTML = teraType
            ? `<span class="tera-badge-excel ${teraClass}">${teraType}</span>`
            : `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;

        // Move Cells: Display type badge and name, or "-" placeholder
        const moveCellsHTML = moves.slice(0, 4).map(move => {
            const moveName = move?.name || '-';
            const moveType = move?.type?.toLowerCase() || 'unknown';
            const displayType = moveType !== 'unknown' ? moveType.charAt(0).toUpperCase() + moveType.slice(1) : 'Unknown';
            const safeMoveName = moveName.replace(/"/g, '"').replace(/'/g, '"');

            // Determine content based on whether it's a real move or placeholder
            const moveContent = moveName !== '-' ? `
                <span class="type-badge-excel type-${moveType} mr-1" title="${displayType} Type">${moveType.substring(0, 3).toUpperCase() || '?'}</span>
                ${safeMoveName /* Use original case */}
            ` : `
                <span class="text-gray-400 dark:text-gray-500">-</span>
            `;

            return `<div class="excel-cell cell-move text-xs">${moveContent}</div>`;
        }).join("");


        // --- Construct full row innerHTML ---
        row.innerHTML = `
            <div class="excel-cell cell-sprite">
                <img src="${pokemon.sprite || 'static/assets/pokeball_icon.png'}" alt="${pokemon.name || 'Pokemon'}" class="w-8 h-8 mx-auto object-contain" onerror="this.onerror=null; this.src='static/assets/pokeball_icon.png';">
            </div>
            <div class="excel-cell font-medium cell-wrap">${pokemon.name || 'Unknown'}</div>
            <div class="excel-cell cell-item">${itemCellHTML}</div>
            <div class="excel-cell text-xs cell-wrap">${pokemon.ability || '<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>'}</div>
            <div class="excel-cell cell-tera">${teraCellHTML}</div>
            ${moveCellsHTML}
        `;
        container.appendChild(row); // Add the completed row to the grid container
    });
}


// --- Utility Functions ---
function copyTeamToClipboard(team) {
    if (!team || !team.pokemons) {
        console.warn("Attempted to copy invalid team data.");
        return;
    }

    // Format the team into PokéPaste format
    const teamText = team.pokemons.map(pokemon => {
        if (!pokemon) return ""; // Skip null entries

         // Start with name and item (if exists)
         const name = pokemon.name || "Unknown";
         const item = pokemon.item ? ` @ ${pokemon.item}` : ""; // Item is already null if missing/"None"

         // Add Ability line if exists
         const ability = pokemon.ability ? `Ability: ${pokemon.ability}` : "";

         // Add Tera Type line if exists
         const tera = pokemon.tera_type ? `Tera Type: ${pokemon.tera_type}` : ""; // tera_type is already null if missing/invalid

         // Format moves, filtering out placeholders or missing moves
         const moves = (pokemon.moves || [])
             .map(m => (m && m.name && m.name !== '-') ? `- ${m.name}` : null) // Get name if valid move
             .filter(m => m !== null); // Remove null entries (placeholders)

        // Construct the string for this Pokémon
        let pokemonString = `${name}${item}\n`; // Name and Item on first line
        if (ability) pokemonString += `${ability}\n`; // Add Ability line
        if (tera) pokemonString += `${tera}\n`; // Add Tera line
        if (moves.length > 0) pokemonString += `${moves.join("\n")}`; // Add Move lines

        return pokemonString.trim(); // Remove leading/trailing whitespace for this entry
    }).filter(Boolean).join("\n\n"); // Join Pokémon entries with double newline, filter out empty entries

    // Use Clipboard API to copy
    navigator.clipboard.writeText(teamText).then(() => {
        // Show success feedback message
        const message = document.getElementById("global-copy-message");
        if (message) {
            message.classList.add("visible");
            // Clear previous timeout if it exists
            if (message.timeoutId) clearTimeout(message.timeoutId);
            // Hide message after 2 seconds
            message.timeoutId = setTimeout(() => {
                message.classList.remove("visible");
                message.timeoutId = null; // Clear the stored timeout ID
             }, 2000);
        }
    }).catch(err => {
        // Handle copy failure
        console.error('Failed to copy team:', err);
        alert("Failed to copy Poképaste to clipboard. Check browser permissions or copy manually.");
    });
}

// --- Initial Setup ---
// Check if the initial message exists and manage its visibility
if (initialMessage) {
    if (criteriaContainer.children.length === 0) {
        initialMessage.classList.remove('hidden');
    } else {
        initialMessage.classList.add('hidden');
    }
}

updateDeleteAllButtonVisibility(); // Set initial state of the Clear All button
console.log("script.js loaded and initialized.");