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
/**
 * Populates a select element with options, including a placeholder and optional 'Any' option.
 * Options data should be an array of { key: string, display: string }.
 * @param {HTMLSelectElement} selectElement The select element to populate.
 * @param {Array<{key: string, display: string}>} optionsData Array of option objects.
 * @param {string} placeholder Text for the disabled placeholder option.
 * @param {boolean} addAnyOption Whether to add a non-disabled option with value="" representing "Any".
 */
function populateSelectWithOptions(selectElement, optionsData, placeholder, addAnyOption = true) {
    selectElement.innerHTML = ''; // Clear existing options
    const currentVal = selectElement.value; // Store current value (might be empty string for 'Any')

    // Add placeholder option (always disabled)
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = "";
    placeholderOpt.textContent = placeholder;
    placeholderOpt.disabled = true;
    placeholderOpt.selected = !currentVal; // Select placeholder ONLY if no value (including 'Any') was selected
    selectElement.appendChild(placeholderOpt);

    // Add 'Any' option if requested (non-disabled, value="")
    let anyOpt = null;
    if (addAnyOption) {
        anyOpt = document.createElement('option');
        anyOpt.value = ""; // Represents 'Any'
        // Determine field name for "Any X" text
        let fieldName = selectElement.dataset.field || 'value';
        fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/([A-Z])/g, ' $1'); // Format field name (e.g., move1 -> Move 1)
        anyOpt.textContent = `Any ${fieldName}`;
        selectElement.appendChild(anyOpt);
        // If currentVal was empty string (meaning 'Any' was selected before), reselect it
        if (currentVal === "") {
            anyOpt.selected = true;
            placeholderOpt.selected = false;
        }
    }

    // Add actual options from data
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
            if (anyOpt) anyOpt.selected = false; // Ensure 'Any' isn't selected
        }
    });

     // Final check: if no option ended up selected, default to 'Any' if available, else placeholder
     if (!selectElement.querySelector('option[selected]')) {
         if (anyOpt) { // Check if 'Any' option exists
             anyOpt.selected = true;
             placeholderOpt.selected = false;
         } else {
             placeholderOpt.selected = true; // Fallback to placeholder if no 'Any' option
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
        return;
    }

    // Get template selects
    const pokemonTemplate = criteriaTemplates.querySelector('.pokemon-block');
    const generalTemplate = criteriaTemplates.querySelector('.general-block');

    // --- Populate Pokémon template selects (using GLOBAL sorted data methods initially) ---
    // Pokemon Name
    populateSelectWithOptions(pokemonTemplate.querySelector('.pokemon-select'), DataService.getPokemonSortedByCount(), '-- Select Pokémon --', false); // No 'Any' for primary Pokemon select

    // Item (Global Counts)
    populateSelectWithOptions(pokemonTemplate.querySelector('.item-select'), DataService.getItemsSortedByCount(), '-- Any Item --', true);

    // Ability (Global Counts)
    populateSelectWithOptions(pokemonTemplate.querySelector('.ability-select'), DataService.getAbilitiesSortedByCount(), '-- Any Ability --', true);

    // Tera (Global Counts)
    populateSelectWithOptions(pokemonTemplate.querySelector('.tera-select'), DataService.getTerasSortedByCount(), '-- Any Tera Type --', true);

    // Moves (Global Counts)
    const moveSelects = pokemonTemplate.querySelectorAll('.move-select');
    moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesSortedByCount(), '-- Any Move --', true));

    // Store GLOBAL options for general templates (use sorted data methods)
    generalSelectOptions = {
         item: DataService.getItemsSortedByCount(),
         ability: DataService.getAbilitiesSortedByCount(),
         move: DataService.getMovesSortedByCount(),
         tera: DataService.getTerasSortedByCount(), // Use global tera counts
         role: DataService.getAllRolesLower().map(r => ({ key: r, display: r.charAt(0).toUpperCase() + r.slice(1) })), // Roles remain static list
    };

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
    if (!addCriteriaBtn.contains(e.target) && !addCriteriaMenu.contains(e.target)) {
        addCriteriaMenu.classList.add('hidden');
    }
});

// Handle adding a criterion when a menu item is clicked
addCriteriaMenu.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target.closest('.criteria-menu-item');
    if (target && target.dataset.type) {
        addCriteriaBlock(target.dataset.type);
        addCriteriaMenu.classList.add('hidden');
    }
});

// Function to add a new criteria block to the container
function addCriteriaBlock(type) {
    let template;
    let newBlock;

    if (!isDataReady) {
        console.error("Cannot add criteria: Data is not ready yet.");
        return;
    }

    if (type === 'pokemon') {
        template = criteriaTemplates.querySelector('.pokemon-block');
        newBlock = template.cloneNode(true);
        // Template is already populated with GLOBAL counts by initializeSelects.
        // We don't need to do anything else here, the 'change' listener handles updates.
    } else { // General types (item, ability, move, tera, role)
        template = criteriaTemplates.querySelector('.general-block');
        newBlock = template.cloneNode(true);
        newBlock.dataset.type = type; // Set specific type for the block

        const label = newBlock.querySelector('.criteria-label');
        const select = newBlock.querySelector('.value-select');
        const options = generalSelectOptions[type] || []; // Get pre-sorted GLOBAL options
        const placeholder = `-- Select ${type.charAt(0).toUpperCase() + type.slice(1)} --`;

        label.textContent = `General ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        // Populate the general select with GLOBAL counts/options
        // Placeholder IS the 'Any' selection (value="") for general blocks
        populateSelectWithOptions(select, options, placeholder, false); // addAnyOption = false

        newBlock.querySelector('.remove-criteria-btn').title = `Remove ${type} criterion`;
    }

    // Add remove functionality AFTER cloning and populating
    const removeBtn = newBlock.querySelector('.remove-criteria-btn');
    removeBtn.addEventListener('click', () => {
        newBlock.remove();
        updateDeleteAllButtonVisibility();
    });

    criteriaContainer.appendChild(newBlock);
    updateDeleteAllButtonVisibility();
}

// --- Event Listener for Pokémon Selection Change ---
criteriaContainer.addEventListener('change', (event) => {
    // Check if the changed element is a pokemon-select inside a pokemon-block
    if (event.target.classList.contains('pokemon-select') && event.target.closest('.pokemon-block')) {
        const pokemonBlock = event.target.closest('.pokemon-block');
        const selectedPokemonNameLower = event.target.value; // This is the lowercase key

        const itemSelect = pokemonBlock.querySelector('.item-select');
        const abilitySelect = pokemonBlock.querySelector('.ability-select');
        const teraSelect = pokemonBlock.querySelector('.tera-select');
        const moveSelects = pokemonBlock.querySelectorAll('.move-select');

        if (!selectedPokemonNameLower) {
            // If "-- Select Pokémon --" is chosen, repopulate with GLOBAL counts
            console.log("Pokemon deselected, resetting sub-selects to global counts.");
            if (itemSelect) populateSelectWithOptions(itemSelect, DataService.getItemsSortedByCount(), '-- Any Item --', true);
            if (abilitySelect) populateSelectWithOptions(abilitySelect, DataService.getAbilitiesSortedByCount(), '-- Any Ability --', true);
            if (teraSelect) populateSelectWithOptions(teraSelect, DataService.getTerasSortedByCount(), '-- Any Tera Type --', true);
            moveSelects.forEach(select => populateSelectWithOptions(select, DataService.getMovesSortedByCount(), '-- Any Move --', true));
        } else {
            // Fetch and populate with POKEMON-SPECIFIC counts
            const items = DataService.getItemsForPokemonSorted(selectedPokemonNameLower);
            const abilities = DataService.getAbilitiesForPokemonSorted(selectedPokemonNameLower);
            const teras = DataService.getTerasForPokemonSorted(selectedPokemonNameLower);
            const moves = DataService.getMovesForPokemonSorted(selectedPokemonNameLower);

            if (itemSelect) populateSelectWithOptions(itemSelect, items, '-- Any Item --', true);
            if (abilitySelect) populateSelectWithOptions(abilitySelect, abilities, '-- Any Ability --', true);
            if (teraSelect) populateSelectWithOptions(teraSelect, teras, '-- Any Tera Type --', true);
            moveSelects.forEach(select => populateSelectWithOptions(select, moves, '-- Any Move --', true));
        }
    }
});

// --- Event Listener for Delete All Button ---
deleteAllCriteriaBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to remove all criteria?')) {
        criteriaContainer.innerHTML = '';
        updateDeleteAllButtonVisibility();
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
            const pokemonName = block.querySelector('.pokemon-select').value; // lowercase key
            if (pokemonName) {
                 criterion.pokemonName = pokemonName;
                 // Get values from sub-selects, empty string "" means 'Any' / not specified
                 // Use || null to ensure null is sent if value is "" (for 'Any')
                 criterion.item = block.querySelector('.item-select').value || null;
                 criterion.ability = block.querySelector('.ability-select').value || null;
                 criterion.tera = block.querySelector('.tera-select').value || null;
                 criterion.move1 = block.querySelector('[data-field="move1"]').value || null;
                 criterion.move2 = block.querySelector('[data-field="move2"]').value || null;
                 criterion.move3 = block.querySelector('[data-field="move3"]').value || null;
                 criterion.move4 = block.querySelector('[data-field="move4"]').value || null;
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
    return criteria;
}


// Function to trigger the search process
async function triggerSearch() {
    const queryCriteria = buildQueryFromUI();

    if (queryCriteria.length === 0) {
        teamTitle.textContent = 'Build a Query';
        teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Add criteria using the button above to start searching for teams. Select a Pokémon or a general item/ability/move/tera/role.</div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        if (initialMessage) initialMessage.classList.remove('hidden');
        return;
    }

    if (initialMessage) initialMessage.classList.add('hidden');
    searchText.textContent = "Searching";
    loadingSpinner.classList.remove("hidden");
    searchBtn.disabled = true;
    addCriteriaBtn.disabled = true;
    deleteAllCriteriaBtn.disabled = true;

    teamContainer.innerHTML = '';
    teamTitle.textContent = 'Loading Team...';
    copyAllBtn.classList.add('hidden');
    otherTeamsContainer.classList.add('hidden');
    otherTeamsTitle.classList.add('hidden');
    otherTeamsList.innerHTML = '';

    currentSearchResults = [];
    currentMainTeamIndex = -1;

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const teams = await window.generatePokepaste(queryCriteria);

        if (!teams || teams.length === 0) {
            teamTitle.textContent = 'No Results';
            teamContainer.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">No teams found matching your query. Try adjusting the criteria.</div>`;
            otherTeamsContainer.classList.add('hidden');
        } else {
             currentSearchResults = teams;
             currentMainTeamIndex = 0;
             updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]);

             if (currentSearchResults.length > 1) {
                updateOtherTeamsDisplay();
             } else {
                otherTeamsContainer.classList.add('hidden');
             }
        }

    } catch (error) {
        console.error("Error during search:", error);
        teamTitle.textContent = 'Error';
        teamContainer.innerHTML = `<div class="p-4 text-center text-red-500 dark:text-red-400 text-sm">An error occurred during the search. Please check the console for details. <br><span class="text-xs">${error.message}</span></div>`;
        copyAllBtn.classList.add('hidden');
        otherTeamsContainer.classList.add('hidden');
        currentSearchResults = [];
        currentMainTeamIndex = -1;
    } finally {
        searchText.textContent = "Search";
        loadingSpinner.classList.add("hidden");
        searchBtn.disabled = false;
        addCriteriaBtn.disabled = !isDataReady;
        deleteAllCriteriaBtn.disabled = criteriaContainer.children.length === 0; // Disable if no criteria
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
    teamTitle.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
    displayTeamInGrid(team, teamContainer);
    copyAllBtn.classList.remove('hidden');
    copyAllBtn.onclick = () => copyTeamToClipboard(team);
}

function updateOtherTeamsDisplay() {
    otherTeamsList.innerHTML = '';
    const otherTeams = currentSearchResults.filter((_, index) => index !== currentMainTeamIndex);

    if (otherTeams.length > 0) {
        otherTeamsContainer.classList.remove('hidden');
        otherTeamsTitle.textContent = `${otherTeams.length} other potential match${otherTeams.length > 1 ? 'es' : ''}:`;
        otherTeamsTitle.classList.remove('hidden');

        currentSearchResults.forEach((team, index) => {
            if (index === currentMainTeamIndex) return;

            const teamPreview = document.createElement('div');
            teamPreview.className = 'other-team-preview border p-1.5 rounded-sm cursor-pointer transition-colors duration-150 ease-in-out bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600';
            teamPreview.title = `Click to view: ${team.filename.split('.')[0].replace(/_/g, ' ')}`;
            teamPreview.dataset.teamIndex = index;

            const teamName = document.createElement('div');
            teamName.className = 'text-xs font-semibold truncate mb-1 team-name-preview text-gray-700 dark:text-gray-300';
            teamName.textContent = team.filename.split('.')[0].replace(/_/g, ' ');
            teamPreview.appendChild(teamName);

            const spriteContainer = document.createElement('div');
            spriteContainer.className = 'flex flex-wrap gap-1 justify-center items-center';
            team.pokemons.slice(0, 6).forEach(pokemon => {
                 if (!pokemon) return;
                const img = document.createElement('img');
                img.src = pokemon.sprite || 'static/assets/pokeball_icon.png';
                img.alt = pokemon.name || '';
                img.className = 'w-5 h-5 object-contain inline-block';
                img.onerror = () => { img.src = 'static/assets/pokeball_icon.png'; };
                spriteContainer.appendChild(img);
            });
            teamPreview.appendChild(spriteContainer);

            teamPreview.addEventListener('click', () => {
                const clickedIndex = parseInt(teamPreview.dataset.teamIndex, 10);
                if (!isNaN(clickedIndex) && clickedIndex < currentSearchResults.length) {
                    currentMainTeamIndex = clickedIndex;
                    updateMainTeamDisplay(currentSearchResults[currentMainTeamIndex]);
                    updateOtherTeamsDisplay();
                    teamSheetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    console.error("Invalid team index clicked:", teamPreview.dataset.teamIndex);
                }
            });

            otherTeamsList.appendChild(teamPreview);
        });
    } else {
        otherTeamsContainer.classList.add('hidden');
        otherTeamsTitle.classList.add('hidden');
    }
}


// Function to display team details in the grid (Excel-like)
function displayTeamInGrid(team, container) {
    container.innerHTML = '';

    if (!team || !team.pokemons || team.pokemons.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Team data is empty or invalid.</div>`;
        return;
    }

    // Create Header Row
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

    // Create Data Rows for each Pokémon
    team.pokemons.forEach((pokemon, index) => {
        if (!pokemon) return;

        const row = document.createElement('div');
        const isDarkMode = document.documentElement.classList.contains('dark');
        const altClass = index % 2 === 0
            ? (isDarkMode ? 'dark:bg-gray-800' : 'bg-white')
            : (isDarkMode ? 'dark:bg-excel-dark-alt' : 'bg-gray-50');
        row.className = `excel-row ${altClass}`;

        const itemName = pokemon.item;
        const itemSpriteUrl = itemName
            ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${itemName.toLowerCase().replace(/ /g, '-')}.png`
            : null;
        const teraType = pokemon.tera_type;
        const teraClass = teraType ? `type-${teraType.toLowerCase()}` : 'type-none';

        const moves = [...(pokemon.moves || [])];
        while (moves.length < 4) {
            moves.push({ name: '-', type: 'unknown' });
        }

        // Item Cell
        let itemCellHTML = `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;
        if (itemName) {
            const safeItemName = itemName.replace(/"/g, '"').replace(/'/g, '"');
            itemCellHTML = `
                <img src="${itemSpriteUrl}" alt="${safeItemName}" class="w-4 h-4 mr-1 inline-block object-contain"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"
                     onload="this.style.display='inline'; this.nextElementSibling.style.display='none';"
                     title="${safeItemName}">
                <span class="item-fallback-text" style="display:none;">${itemName}</span>
            `;
        }

        // Tera Cell
        const teraCellHTML = teraType
            ? `<span class="tera-badge-excel ${teraClass}">${teraType}</span>`
            : `<span class="text-gray-400 dark:text-gray-500 italic text-xs">None</span>`;

        // Move Cells
        const moveCellsHTML = moves.slice(0, 4).map(move => {
            const moveName = move?.name || '-';
            const moveType = move?.type?.toLowerCase() || 'unknown';
            const displayType = moveType !== 'unknown' ? moveType.charAt(0).toUpperCase() + moveType.slice(1) : 'Unknown';
            const safeMoveName = moveName.replace(/"/g, '"').replace(/'/g, '"');

            const moveContent = moveName !== '-' ? `
                <span class="type-badge-excel type-${moveType} mr-1" title="${displayType} Type">${moveType.substring(0, 3).toUpperCase() || '?'}</span>
                ${safeMoveName}
            ` : `
                <span class="text-gray-400 dark:text-gray-500">-</span>
            `;
            return `<div class="excel-cell cell-move text-xs">${moveContent}</div>`;
        }).join("");

        // Construct full row
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
        container.appendChild(row);
    });
}


// --- Utility Functions ---
function copyTeamToClipboard(team) {
    if (!team || !team.pokemons) {
        console.warn("Attempted to copy invalid team data.");
        return;
    }

    const teamText = team.pokemons.map(pokemon => {
        if (!pokemon) return "";

         const name = pokemon.name || "Unknown";
         const item = pokemon.item ? ` @ ${pokemon.item}` : "";
         const ability = pokemon.ability ? `Ability: ${pokemon.ability}` : "";
         const tera = pokemon.tera_type ? `Tera Type: ${pokemon.tera_type}` : "";
         const moves = (pokemon.moves || [])
             .map(m => (m && m.name && m.name !== '-') ? `- ${m.name}` : null)
             .filter(m => m !== null);

        let pokemonString = `${name}${item}\n`;
        if (ability) pokemonString += `${ability}\n`;
        if (tera) pokemonString += `${tera}\n`;
        if (moves.length > 0) pokemonString += `${moves.join("\n")}`;

        return pokemonString.trim();
    }).filter(Boolean).join("\n\n");

    navigator.clipboard.writeText(teamText).then(() => {
        const message = document.getElementById("global-copy-message");
        if (message) {
            message.classList.add("visible");
            if (message.timeoutId) clearTimeout(message.timeoutId);
            message.timeoutId = setTimeout(() => {
                message.classList.remove("visible");
                message.timeoutId = null;
             }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy team:', err);
        alert("Failed to copy Poképaste to clipboard. Check browser permissions or copy manually.");
    });
}

// --- Initial Setup ---
if (initialMessage) {
    if (criteriaContainer.children.length === 0) {
        initialMessage.classList.remove('hidden');
    } else {
        initialMessage.classList.add('hidden');
    }
}

updateDeleteAllButtonVisibility();