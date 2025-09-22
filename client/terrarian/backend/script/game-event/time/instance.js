import { TimeGameEvent, __timeGameEvents__ } from "./class.js";

export class TickChangeGameEvent extends TimeGameEvent {
    static id = "game-event.tick-change";
    static type = "tick-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class DayChangeGameEvent extends TimeGameEvent {
    static id = "game-event.day-change";
    static type = "day-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class WeekChangeGameEvent extends TimeGameEvent {
    static id = "game-event.week-change";
    static type = "week-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class MonthChangeGameEvent extends TimeGameEvent {
    static id = "game-event.month-change";
    static type = "month-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class SeasonChangeGameEvent extends TimeGameEvent {
    static id = "game-event.season-change";
    static type = "season-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class SemesterChangeGameEvent extends TimeGameEvent {
    static id = "game-event.semester-change";
    static type = "semester-change";
    static {
        __timeGameEvents__.link(this);
    }
}
export class YearChangeGameEvent extends TimeGameEvent {
    static id = "game-event.year-change";
    static type = "year-change";
    static {
        __timeGameEvents__.link(this);
    }
}