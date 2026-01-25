import { Game } from "./game.js";

const bin = exp => Math.pow(2, exp);
export class Time {
    static #__tps = 20; /* ticks per second */
    static #__spd = 10; /* seconds per day */

    static second = n => n * this.#__tps; /* 20 ticks (1s) */
    static day = n => Time.second(n * this.#__spd); /* 200 ticks (10s) */
    static week = n => Time.day(n * 7); /* 1,400 ticks (1m10s) */
    static month = n => Time.week(n * 4); /* 5,600 ticks (4m40s) */
    static season = n => Time.month(n * 3); /* 22,400 ticks (14m00s) */
    static semester = n => Time.season(n * 2); /* 44,800 ticks (28m00s) */
    static year = n => Time.semester(n * 2); /* 89,600 ticks (56m00s) */

    static {
        this.Month = class Month {
            static March = bin(0);
            static April = bin(1);
            static May = bin(2);
            static June = bin(3);
            static July = bin(4);
            static August = bin(5);
            static September = bin(6);
            static October = bin(7);
            static November = bin(8);
            static December = bin(9);
            static January = bin(10);
            static February = bin(11);

            static order = [
                "March", "April", "May",
                "June", "July", "August",
                "September", "October", "November",
                "December", "January", "February",
            ];
        }

        this.Season = class Season {
            static Spring = this.Month.March | this.Month.April | this.Month.May;
            static Summer = this.Month.June | this.Month.July | this.Month.August
            static Autumn = this.Month.September | this.Month.October | this.Month.November;
            static Winter = this.Month.December | this.Month.January | this.Month.February;

            static order = [ "Spring", "Summer", "Autumn", "Winter" ];
        }

        this.Semester = class Semester {
            static Warm = this.Season.Spring | this.Season.Summer;
            static Cold = this.Season.Autumn | this.Season.Winter;

            static order = [ "Warm", "Cold" ];
        }

        this.Year = this.Semester.Warm | this.Semester.Cold;
    }

    static get TPS() {
        return Time.#__tps;
    }

    static #time = {
        value: Date.now(),
        when: Date.now(),
    };
    static sync(value, when) {
        this.#time.value = value || Date.now();
        this.#time.when = when || Date.now();
    }

    static get now() {
        const elapsed = Date.now() - this.#time.when;
        return this.#time.value + elapsed;
    }

    static getDay(tick = Game.tick) {
        const oneDay = this.day(1);
        return Math.floor(tick / oneDay) % (this.month(1) / oneDay) + 1;
    }
    static getWeek(tick = Game.tick) {
        const oneWeek = this.week(1);
        return Math.floor(tick / oneWeek) % (this.month(1) / oneWeek) + 1;
    }
    static getMonth(tick = Game.tick) {
        const order = this.Month.order;
        return order[Math.floor(tick / this.month(1)) % order.length];
    }
    static getSeason(tick = Game.tick) {
        const order = this.Season.order;
        return order[Math.floor(tick / this.season(1)) % order.length];
    }
    static getSemester(tick = Game.tick) {
        const order = this.Semester.order;
        return order[Math.floor(tick / this.semester(1)) % order.length];
    }
    static getYear(tick = Game.tick) {
        return Math.floor(tick / this.year(1)) + 1;
    }
}