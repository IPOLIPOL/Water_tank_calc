const fs = require('fs');
const path = require('path');
const Table = require('cli-table3');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseInputFile(filePath) {
    const input = fs.readFileSync(filePath, 'utf-8');
    const lines = input.split(/\r?\n/);
    const refillData = {};
    let consumption = 2000;

    for (const line of lines) {
        const cleanLine = line.split('#')[0].trim();
        if (!cleanLine) continue;

        if (cleanLine.startsWith('Consumption:')) {
            consumption = parseInt(cleanLine.split(':')[1].trim(), 10);
        } else {
            const [monthRaw, volumeRaw] = cleanLine.split(':');
            const month = monthRaw.trim();
            const volume = parseInt(volumeRaw.trim(), 10);
            if (MONTHS.includes(month)) {
                refillData[month] = volume;
            }
        }
    }

    return { refillData, consumption };
}

function calculateTable(refillData, consumption, startingVolume = 2000, maxCapacity = 2000) {
    const results = [];
    let volume = startingVolume;
    let maxDeficit = 0;

    for (let i = 0; i < MONTHS.length; i++) {
        const month = MONTHS[i];
        const received = refillData[month] ?? 0;
        const begin = volume;

        let withdrawn = 0;
        let deficit = '—';

        const isEvenMonth = (i + 1) % 2 === 0;
        if (isEvenMonth) {
            withdrawn = consumption;
            if (volume < consumption) {
                const shortfall = consumption - volume;
                deficit = '-' + shortfall;
                maxDeficit = Math.max(maxDeficit, shortfall);
                withdrawn = volume;
                volume = 0;
            } else {
                volume -= consumption;
            }
        }

        volume += received;
        const surplus = Math.max(0, volume - maxCapacity);
        volume = Math.min(volume, maxCapacity);

        results.push({
            month,
            begin,
            withdrawn,
            received,
            end: volume,
            deficit,
        });
    }

    return {
        table: results,
        finalVolume: volume,
        maxDeficit,
        hasDeficit: results.some(row => row.deficit !== '—')
    };
}

function printTable(title, tableData) {
    const table = new Table({
        head: ['Месяц', 'Начало', 'Отбор', 'Поступило', 'Конец', 'Дефицит'],
        colWidths: [8, 10, 10, 12, 8, 10],
    });

    tableData.forEach(row => {
        table.push([
            row.month,
            row.begin,
            row.withdrawn,
            row.received,
            row.end,
            row.deficit,
        ]);
    });

    console.log(title);
    console.log(table.toString());
}

function findMinimumCapacity(refillData, consumption) {
    let low = consumption;
    let high = 10000;
    let answer = high;

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const result = calculateTable(refillData, consumption, mid, mid);

        if (!result.hasDeficit) {
            answer = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
    }

    return answer;
}

function main() {
    const inputPath = path.join(__dirname, 'input.txt');
    const { refillData, consumption } = parseInputFile(inputPath);

    const firstRun = calculateTable(refillData, consumption);
    printTable('\n📊 ОСНОВНОЙ РАСЧЁТ:', firstRun.table);

    console.log(`Примечание: отбор происходит перед доливом`);
    console.log(`Оптимальный объем определяется методом бинарного поиска`);
    /*console.log(`📦 Максимальный дефицит за год: ${firstRun.maxDeficit} литров`);
    console.log(`🔢 Рекомендуемый объём бочки: ${2000 + firstRun.maxDeficit} литров`);*/

    const optimalCapacity = findMinimumCapacity(refillData, consumption);
    const secondRun = calculateTable(refillData, consumption, optimalCapacity, optimalCapacity);
    printTable('\n🔁 ПРОВЕРОЧНЫЙ ПОВТОР С ОПТИМАЛЬНЫМ ОБЪЁМОМ:', secondRun.table);
    console.log(`✅ Минимально достаточный объём бочки: ${optimalCapacity} литров`);
}

main();
