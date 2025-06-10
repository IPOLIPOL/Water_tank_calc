const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');

// === Pure functions ===

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];


// Parses structured text input 
function parseInputText(input) {
    const lines = input.split(/\r?\n/); //use built-in menthod to split the input text to strings
    const refillData = {}; // stores the refill volume by months in array

    // Default values — will be overwritten if specified in the input
    let consumption = 2000;
    let initialCapacity = 2000;

    // Iterate through the lines
    for (const line of lines) {

        //Remove comments (everything after #), trim whitespace and skip empty lines
        const cleanLine = line.split('#')[0].trim();
        if (!cleanLine) continue;

        // Try to split the line into a key and value pair by colon
        const [keyRaw, valueRaw] = cleanLine.split(':');
        if (!keyRaw || !valueRaw) continue; // Skip malformed lines

        // Normalize the key to lowercase to make comparison case-insensitive
        const key = keyRaw.trim().toLowerCase();
        // Try to convert the value to a number
        const value = parseInt(valueRaw.trim(), 10);

        // Handle special keys for consumption and tank volume
        if (key === 'consumption') {
            consumption = value;
        } else if (key === 'initial tank volume') {
            initialCapacity = value;
        } else {
            // Otherwise, treat the key as a month name (preserve original capitalization)
            const month = keyRaw.trim(); 
            if (MONTHS.includes(month)) {
                refillData[month] = value;
            }
        }
    }

    return { refillData, consumption, initialCapacity };
}

// Simulates tank usage over 12 months by applying withdrawals and refills.
// Returns raw tableData per month along with calculated summary values.
function calculateTable(refillData, consumption, startingVolume, maxCapacity) {
    const results = []; // will hold the resulting array
    let volume = startingVolume;
    let maxDeficit = 0; //will hold the largest deficit across all months

    // Iterate through all 12 months
    for (let i = 0; i < MONTHS.length; i++) {
        const month = MONTHS[i];
        const received = refillData[month] ?? 0;
        const begin = volume; // holds initial volume for this month

        let withdrawn = 0; // How much was withdrawn this month
        let deficit = '—'; // Default deficit is none

        // 1) Withdrawal
        const isEvenMonth = (i + 1) % 2 === 0;
        if (isEvenMonth) {
            withdrawn = consumption;
            if (volume < consumption) {
                const shortfall = consumption - volume;
                deficit = '-' + shortfall;
                maxDeficit = Math.max(maxDeficit, shortfall); // update tracked deficit
                withdrawn = volume; // Only withdraw what is available
                volume = 0;
            } else {
                volume -= consumption; // Sufficient water – subtract
            }
        }

        //2) Refilling
        volume += received;
        const surplus = Math.max(0, volume - maxCapacity); // If overfilled, compute surplus. Not used
        volume = Math.min(volume, maxCapacity); // Cap at max capacity

        // Store result for this month
        results.push({
            month,
            begin,
            withdrawn,
            received,
            end: volume,
            deficit,
        });
    }

    // Return full result structure
    return {
        table: results,             // Array of month summaries
        finalVolume: volume,
        maxDeficit,
        hasDeficit: results.some(row => row.deficit !== '—') // True if any month had deficit
    };
}

// finds the minimum tank volume required to avoid any deficits
function findMinimumCapacity(refillData, consumption) {
    let low = consumption; //setting the lower search limit
    let high = 10000; //setting the upper search limit
    let answer = null; //Best result found so far

    // Binary search loop
    while (low <= high) {
        const mid = Math.floor((low + high) / 2); // Try the midpoint capacity
        const result = calculateTable(refillData, consumption, mid, mid); //Year evaluation with the starting and max tank level = mid

        if (!result.hasDeficit) {
            answer = mid; //stores mid as a possible result
            high = mid - 1; // next search in a smaller solution space 
        } else {
            low = mid + 1; //next search in a bigger solution space 
        }
    }

    return answer;
}

// takes tableData array and converts it into a formatted ASCII table using cli-table3
function getTableString(tableData) {

    //Instantiation of an object of the class 'Table' from 'cli-table3' using the constructor
    //Setting up its columns  
    const table = new Table({
        head: ['Month', 'Beginning', 'Discharge', 'Inlet', 'End', 'Deficit'],
        colWidths: [8, 12, 12, 8, 8, 10],
    });

    // Call the 'row' function for each tableData array element
    tableData.forEach(row => {
        // 'cli-table3' method .push adds an array of values as a row in a table.
        table.push([
            row.month,
            row.begin,
            row.withdrawn,
            row.received,
            row.end,
            row.deficit,
        ]);
    });

    // 'cli-table3' method .toString() returns all text rows formatted as ASCII-table
    return table.toString();
}

// === Impure functions ===

// input.txt parsing
function parseInputFile(filePath) {

    // read and convert the file into the string; 
    // write the string to the "input"
    const input = fs.readFileSync(filePath, 'utf-8'); 

    // call the parseInputText function to parse the string into the data structure
    // returns the object {refillData, consumption, initialCapacity}
    return parseInputText(input); 
}

// print table with title
function printTable(title, tableData) {
    console.log(title);
    console.log(getTableString(tableData));
}

function main() {

    // writing the full path to the 'input.txt' to the inputPath variable
    const inputPath = path.join(__dirname, 'input.txt');
    // writing of the input data to three variables by destructing the object returned by parseInputFile
    const { refillData, consumption, initialCapacity } = parseInputFile(inputPath);

    // Calculation of the first table and writing the result to "firstRun"
    // result is stored as an array of month rows with data 
    const firstRun = calculateTable(refillData, consumption, initialCapacity, initialCapacity);
    // Output of the first table
    printTable('\nDEFICIT IDENTIFICATION:', firstRun.table);
    console.log(`Note: withdrawal occurs before topping up.`);
    console.log(`Note: optimal volume is determined by the binary search method.`);

    // Call for binary search function. Returns either the desired value or null
    const optimalCapacity = findMinimumCapacity(refillData, consumption);
    // Returns 10000 if optimalCapacity was not found (null) 
    const finalCapacity = optimalCapacity ?? 10000;

    // Calculation of the second table and writing the result to "secondRun"
    const secondRun = calculateTable(refillData, consumption, finalCapacity, finalCapacity);
    // Output of the second table
    printTable('\nTEST ITERATION WITH OPTIMAL VOLUME:', secondRun.table);
    if (optimalCapacity === null) {
        console.log(`\n❌ Even with the maximum tank volume (10,000 liters), it is impossible to avoid a deficit.`);
        console.log(`ℹ️ The manual refilling will be required.`);
    } else {
        console.log(`Minimum sufficient volume of the tank: ${optimalCapacity} liters`);
    }
} 

main();
