import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Profiler {
    constructor() {
        this.metricsDir = path.join(__dirname, "../metrics/access");
        this.currentData = {};
        this.currentMonth = null;
        this.currentFilePath = null;

        // Initialize the profiler
        this.initializeProfiler();

        // Set up daily reset at midnight
        this.scheduleMidnightReset();
    }

    initializeProfiler() {
        const now = new Date();
        const month = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        this.currentMonth = month;
        this.currentFilePath = path.join(this.metricsDir, `${month}.json`);

        // Load existing data or initialize new structure
        this.loadOrInitializeData();

        // Ensure today's entry exists
        this.ensureTodaysEntry(day);
    }

    loadOrInitializeData() {
        try {
            if (fs.existsSync(this.currentFilePath)) {
                const fileContent = fs.readFileSync(this.currentFilePath, 'utf8');
                this.currentData = JSON.parse(fileContent);
            } else {
                this.currentData = {};
                this.saveData();
            }
        } catch (error) {
            console.error('Error loading profiler data:', error);
            this.currentData = {};
        }
    }

    ensureTodaysEntry(day) {
        if (!this.currentData[day]) {
            this.currentData[day] = {
                logins: 0,
                requests: {
                    GET: 0,
                    POST: 0,
                    PUT: 0,
                    DELETE: 0
                }
            };
            this.saveData();
        }
    }

    saveData() {
        try {
            // Ensure directory exists
            fs.mkdirSync(this.metricsDir, { recursive: true });

            // Write data with pretty formatting
            fs.writeFileSync(this.currentFilePath, JSON.stringify(this.currentData, null, 2), 'utf8');
        } catch (error) {
            console.error('Error saving profiler data:', error);
        }
    }

    checkMonthChange() {
        const now = new Date();
        const month = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0');

        if (month !== this.currentMonth) {
            // Month has changed, switch to new file
            this.currentMonth = month;
            this.currentFilePath = path.join(this.metricsDir, `${month}.json`);
            this.loadOrInitializeData();
        }
    }

    getTodaysKey() {
        const now = new Date();
        return String(now.getDate()).padStart(2, '0');
    }

    recordLogin() {
        this.checkMonthChange();
        const today = this.getTodaysKey();
        this.ensureTodaysEntry(today);

        this.currentData[today].logins++;
        this.saveData();

        console.log(`[Profiler] Login recorded for ${this.currentMonth}-${today}. Total logins today: ${this.currentData[today].logins}`);
    }

    recordRequest(method) {
        this.checkMonthChange();
        const today = this.getTodaysKey();
        this.ensureTodaysEntry(today);

        const upperMethod = method.toUpperCase();
        if (this.currentData[today].requests.hasOwnProperty(upperMethod)) {
            this.currentData[today].requests[upperMethod]++;
            this.saveData();

            console.log(`[Profiler] ${upperMethod} request recorded for ${this.currentMonth}-${today}. Total ${upperMethod} requests today: ${this.currentData[today].requests[upperMethod]}`);
        }
    }

    scheduleMidnightReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        setTimeout(() => {
            this.initializeProfiler(); // Reinitialize for the new day
            this.scheduleMidnightReset(); // Schedule next midnight reset
        }, msUntilMidnight);

        console.log(`[Profiler] Next midnight reset scheduled in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
    }

    // Middleware function for Express
    getRequestMiddleware() {
        return (req, res, next) => {
            this.recordRequest(req.method);
            next();
        };
    }

    // Get current day statistics
    getTodaysStats() {
        const today = this.getTodaysKey();
        return this.currentData[today] || {
            logins: 0,
            requests: {
                GET: 0,
                POST: 0,
                PUT: 0,
                DELETE: 0
            }
        };
    }

    // Get all data for current month
    getCurrentMonthData() {
        return {
            month: this.currentMonth,
            data: this.currentData
        };
    }
}

// Export singleton instance
const profiler = new Profiler();
export default profiler;
