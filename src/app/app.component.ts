import { Component, NgZone } from '@angular/core';
import { NgxFileDropEntry } from 'ngx-file-drop';
import { Fitbod } from './models/fitbod';
import { Hevy } from './models/hevy';
import * as moment from 'moment';
import { saveAs } from 'file-saver';

/**
 * Fitbod's export carries only a start timestamp per workout and no end time, so the
 * real workout length cannot be derived. Hevy requires a value; this is an estimate.
 */
export const ESTIMATED_WORKOUT_DURATION = '60m';

/** Fitbod exercise name -> Hevy built-in exercise name. Unmapped names pass through unchanged. */
export const EXERCISE_MAPPINGS: Readonly<Record<string, string>> = {
    "Single Leg Kickback": "Glute Kickback on Floor",
    "Single Arm Dumbbell Tricep Extension": "Single Arm Tricep Extension (Dumbbell)",
    "Seated Tricep Press": "Seated Triceps Press",
    "Reverse Dumbbell Curl": "Reverse Curl (Dumbbell)",
    "Scissor Kick": "Ab Scissors",
    "Pike Push Up": "Pike Pushup",
    "Leg Raise": "Lying Leg Raise",
    "Incline Dumbbell Row": "Chest Supported Incline Row (Dumbbell)",
    "Incline Dumbbell Curl": "Seated Incline Curl (Dumbbell)",
    "Elevated Hip Bridge": "Hip Thrust (Bodyweight)",
    "Jackknife Sit-Up": "Jackknife Sit Up",
    "Hammer Curls": "Hammer Curl (Dumbbell)",
    "Dumbbell Squat": "Squat (Dumbbell)",
    "Dumbbell Shoulder Raise": "Lateral Raise (Dumbbell)",
    "Dumbbell Rear Delt Raise": "Rear Delt Reverse Fly (Dumbbell)",
    // Hevy has no dumbbell hip thrust; merged into the barbell exercise on purpose.
    "Dumbbell Hip Thrust": "Hip Thrust (Barbell)",
    "Dumbbell Goblet Squat": "Goblet Squat",
    "Dumbbell Front Raise": "Front Raise (Dumbbell)",
    "Dumbbell Fly": "Chest Fly (Dumbbell)",
    "Dumbbell Bent Over Reverse Fly": "Rear Delt Reverse Fly (Dumbbell)",
    "Bodyweight Bulgarian Split Squat": "Bulgarian Split Squat",
    "Vertical Leg Raise": "Leg Raise Parallel Bars",
    "Single Leg Leg Extension": "Single Leg Extensions",
    "Air Squats": "Squat (Bodyweight)",
    "Dumbbell Bent Over Row": "Bent Over Row (Dumbbell)",
    "Decline Sit Up": "Decline Crunch",
    "Dumbbell Bulgarian Split Squat": "Bulgarian Split Squat",
    "Dip": "Triceps Dip",
    "Lying Hamstrings Curl": "Lying Leg Curl (Machine)",
    "Barbell Incline Bench Press": "Incline Bench Press (Barbell)",
    "Dumbbell Incline Bench Press": "Incline Bench Press (Dumbbell)",
    "Smith Machine Incline Bench Press": "Incline Bench Press (Smith Machine)",
    "Smith Machine Bench Press": "Bench Press (Smith Machine)",
    "Dumbbell Bench Press": "Bench Press (Dumbbell)",
    "Barbell Bench Press": "Bench Press (Barbell)",
    "Machine Bench Press": "Chest Press (Machine)",
    "Dumbbell Pullover": "Pullover (Dumbbell)",
    "Dumbbell Decline Bench Press": "Decline Bench Press (Dumbbell)",
    "Barbell Decline Bench Press": "Decline Bench Press (Barbell)",
    "Standing Arnold Press": "Arnold Press (Dumbbell)",
    "Arnold Dumbbell Press": "Arnold Press (Dumbbell)",
    "Standing Dumbbell Shoulder Press": "Overhead Press (Dumbbell)",
    "Dumbbell Shoulder Press": "Shoulder Press (Dumbbell)",
    "Seated Barbell Shoulder Press": "Seated Overhead Press (Barbell)",
    "Machine Shoulder Press": "Seated Shoulder Press (Machine)",
    "Barbell Shoulder Press": "Overhead Press (Barbell)",
    "Smith Machine Overhead Shoulder Press": "Overhead Press (Smith Machine)",
    "Dumbbell Skullcrusher": "Skullcrusher (Dumbbell)",
    "EZ-Bar Skullcrusher": "Skullcrusher (Barbell)",
    "Skullcrusher": "Skullcrusher (Dumbbell)",
    "Lat Pulldown": "Lat Pulldown (Cable)",
    "Machine Fly": "Chest Fly (Machine)",
    "Mid Cable Crossover Fly": "Cable Fly Crossovers",
    "Machine Rear Delt Fly": "Rear Delt Reverse Fly (Machine)",
    "Machine Leg Press": "Leg Press (Machine)",
    "Back Squat": "Squat (Barbell)",
    "Pause Back Squat": "Pause Squat (Barbell)",
    "Dumbbell Sumo Squat": "Sumo Squat (Dumbbell)",
    "Kettlebell Sumo Squat": "Sumo Squat (Kettlebell)",
    "Leg Extension": "Leg Extension (Machine)",
    "Seated Leg Curl": "Seated Leg Curl (Machine)",
    "Leg Curl": "Lying Leg Curl (Machine)",
    "Machine Hip Abductor": "Hip Abduction (Machine)",
    "Machine Tigh Abductor": "Hip Abduction (Machine)",
    "Machine Hip Adductor": "Hip Adduction (Machine)",
    "Calf Press": "Calf Press (Machine)",
    "Seated Machine Calf Press": "Calf Press (Machine)",
    "Standing Calf Press": "Calf Press (Machine)",
    "Dumbbell Lunge": "Lunge (Dumbbell)",
    "Barbell Lunge": "Lunge (Barbell)",
    "Side Lunge": "Lateral Lunge",
    "EZ-Bar Curl": "EZ Bar Biceps Curl",
    "Close-Grip EZ-Bar Curl": "EZ Bar Biceps Curl",
    "Cable Rope Tricep Extension": "Triceps Rope Pushdown",
    "Cable Tricep Extension": "Triceps Rope Pushdown",
    "Triceps Pressdown": "Triceps Pushdown",
    "Bent Over Barbell Row": "Bent Over Row (Barbell)",
    "Cable Row": "Seated Cable Row - Bar Grip",
    "Cable Row with Squat": "Squat Row",
    "Cable Upright Row": "Upright Row (Cable)",
    "T-Bar Row": "T Bar Row",
    "Machine Row": "Seated Row (Machine)",
    "Straight-Arm Pulldown": "Rope Straight Arm Pulldown",
    "Hammerstrength Iso Row": "Iso-Lateral Row (Machine)",
    "Dumbbell Shrug": "Shrug (Dumbbell)",
    "Barbell Shrug": "Shrug (Barbell)",
    "Cable Shrug": "Shrug (Cable)",
    "Lateral Raise": "Lateral Raise (Dumbbell)",
    "Side Lateral Raise": "Lateral Raise (Dumbbell)",
    "Cable Lateral Raise": "Lateral Raise (Cable)",
    "Machine Lateral Raise": "Lateral Raise (Machine)",
    "Smith Machine Shrug": "Shrug (Smith Machine)",
    "Smith Machine Behind the Back Shrug Shrug": "Shrug (Smith Machine)",
    "Deadlift": "Deadlift (Barbell)",
    "Romanian Deadlift": "Romanian Deadlift (Barbell)",
    "Dumbbell Romanian Deadlift": "Romanian Deadlift (Dumbbell)",
    "Low Cable Chest Fly": "Low Cable Fly Crossovers",
    "Cable Crossover Fly": "Cable Fly Crossovers",
    "Dumbbell Incline Fly": "Incline Chest Fly (Dumbbell)",
    "Dumbbell Bicep Curl": "Bicep Curl (Dumbbell)",
    "Cable Bicep Curl": "Bicep Curl (Cable)",
    "Barbell Curl": "Bicep Curl (Barbell)",
    "Dumbbell Preacher Curl": "Preacher Curl (Dumbbell)",
    "Preacher Curl": "Preacher Curl (Barbell)",
    "Machine Preacher Curl": "Preacher Curl (Machine)",
    "Crunches": "Crunch"
};

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    files: NgxFileDropEntry[] = [];
    /** Progress or result of the last conversion, shown to the user. */
    status = '';
    /** Why the last conversion failed, shown to the user. Empty when there is no error. */
    error = '';
    /** The last successfully converted file, so the download can be retried from a click. */
    lastConverted: File | null = null;

    constructor(private zone: NgZone) { }

    dropped(files: NgxFileDropEntry[]) {
        this.files = files;
        this.status = '';
        this.error = '';
        this.lastConverted = null;

        const droppedFile = files[0];
        if (!droppedFile) {
            return;
        }
        if (!droppedFile.fileEntry.isFile) {
            this.error = 'Folders are not supported. Drop the WorkoutExport.csv file itself.';
            return;
        }

        const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
        this.status = `Reading ${droppedFile.relativePath}...`;
        fileEntry.file((file: File) => {
            const reader = new FileReader();
            // File callbacks can run outside Angular's zone; run state changes inside it so the view updates.
            reader.onerror = () => this.zone.run(() => this.fail(`Could not read ${file.name}.`));
            reader.onload = () => this.zone.run(() => {
                try {
                    this.convertText(file.name, reader.result as string);
                } catch (e) {
                    this.fail(e instanceof Error ? e.message : String(e));
                }
            });
            reader.readAsText(file);
        });
    }

    /** Converts Fitbod CSV text, updates the status line and starts the download. Throws on invalid input. */
    convertText(fileName: string, text: string): void {
        if (!text.startsWith('Date,Exercise')) {
            throw new Error(`${fileName} does not look like a Fitbod export: expected a header starting with "Date,Exercise".`);
        }
        const fitbodData: Fitbod[] = this.csvJSON(text);
        if (fitbodData.length === 0) {
            throw new Error(`${fileName} contains no sets.`);
        }
        const hevyData = this.fitBodToHevy(fitbodData);
        this.lastConverted = new File([this.JSONtoCSV(hevyData)], 'FitBodToHevyConvertedFile.csv', { type: 'text/csv' });
        this.status = `Converted ${hevyData.length} sets from ${fileName}. The download should start now; if it does not, use the button below.`;
        this.download();
    }

    /** Starts (or restarts) the download of the last converted file. */
    download(): void {
        if (this.lastConverted) {
            this.triggerDownload(this.lastConverted);
        }
    }

    /** Separate so tests can stub the browser download. */
    triggerDownload(file: File): void {
        saveAs(file);
    }

    private fail(message: string): void {
        this.status = '';
        this.error = `Conversion failed: ${message}`;
        console.error(message);
    }

    fileOver(event: any) {
        console.log(event);
    }

    fileLeave(event: any) {
        console.log(event);
    }

    fitBodToHevy(fitBodData: Fitbod[]): Hevy[] {
        const hevyData: Hevy[] = [];
        const setOrdersMap = new Map<string, number>(); // Map to track set orders for unique exercise and date combinations

        fitBodData.forEach((entry) => {
            const exerciseKey = `${entry.Date.substring(0, 10)}_${entry.Exercise}`; // Unique key for each exercise and date

            const setOrder = setOrdersMap.get(exerciseKey) ?? 1; // Set order for this exercise and date
            setOrdersMap.set(exerciseKey, setOrder + 1); // Increment set order for the next entry

            const exerciseName = EXERCISE_MAPPINGS[entry.Exercise] ?? entry.Exercise;

            hevyData.push({
                Date: entry.Date.substring(0, 19),
                "Workout Name": "Workout on: " + moment(entry.Date).format('YYYY-MM-DD'),
                "Exercise Name": exerciseName,
                "Set Order": setOrder,
                Weight: (parseFloat(entry['Weight(kg)']) * parseInt(entry.multiplier)),
                "Weight Unit": "kg",
                Reps: parseInt(entry.Reps),
                RPE: null,
                Distance: null,
                "Distance Unit": null,
                Seconds: parseInt(entry["Duration(s)"]) || 0,
                Notes: null,
                "Workout Notes": null,
                "Workout Duration": ESTIMATED_WORKOUT_DURATION,
            });
        });

        return hevyData;
    }


    JSONtoCSV(json: any[]): string {
        const items = json
        const header = Object.keys(items[0])
        const replacer = (key: any, value: any) => value === null ? '' : value // specify how you want to handle null values here
        const csv = [
            header.join(';'), // header row first
            ...items.map((row) => header.map((fieldName) => {
                let output = row[fieldName] ? row[fieldName] : '';
                if (["Exercise Name", "Workout Name", "Notes", "Workout Notes", "Set Order"].includes(fieldName)) {
                    output = JSON.stringify(row[fieldName], replacer);
                }
                return output;
            }).join(';'))
        ].join('\r\n')

        return csv;
    }

    csvJSON(csv: string): any[] {
        var lines = csv.split(/\r?\n/).filter((line) => line.trim() !== ""); // CRLF-safe; a trailing newline must not become a row

        var result = [];

        var headers = lines[0].split(",");

        console.log(headers);

        headers[10] = "multiplier";
        console.log(headers);

        for (var i = 1; i < lines.length; i++) {

            var obj: any = {};
            var currentline = lines[i].split(",");

            for (var j = 0; j < headers.length; j++) {
                obj[headers[j]] = currentline[j];
            }

            result.push(obj);

        }

        //return result; //JavaScript object
        return JSON.parse(JSON.stringify(result)); //JSON
    }
}
