import { Component } from '@angular/core';
import { NgxFileDropEntry } from 'ngx-file-drop';
import { Fitbod } from './models/fitbod';
import { Hevy } from './models/hevy';
import * as moment from 'moment';
import { saveAs } from 'file-saver';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent {
    files: NgxFileDropEntry[] = [];

    dropped(files: NgxFileDropEntry[]) {
        this.files = files;
        for (const droppedFile of files) {

            // Is it a file?
            if (droppedFile.fileEntry.isFile) {
                const fileEntry = droppedFile.fileEntry as FileSystemFileEntry;
                fileEntry.file((file: File) => {

                    // Here you can access the real file
                    console.log(droppedFile.relativePath, file);


                    const reader = new FileReader();
                    reader.onload = () => {
                        let text: any = reader.result;
                        let fitbodData: Fitbod[] = this.csvJSON(text);

                        const hevyData = this.fitBodToHevy(fitbodData);
                        console.log(hevyData);
                        const file = new File([this.JSONtoCSV(hevyData)], 'FitBodToHevyConvertedFile.csv', { type: "csv/text" });

                        saveAs(file);
                        // fitbodData.forEach((data) => {
                        //     console.log(data.Date);
                        // })
                    };
                    reader.readAsText(file);

                });
            } else {
                // It was a directory (empty directories are added, otherwise only files)
                const fileEntry = droppedFile.fileEntry as FileSystemDirectoryEntry;
                console.log(droppedFile.relativePath, fileEntry);
            }
        }
    }

    fileOver(event: any) {
        console.log(event);
    }

    fileLeave(event: any) {
        console.log(event);
    }

    fitBodToHevy(fitBodData: Fitbod[]): Hevy[] {
        let hevyData: Hevy[] = [];
        const setOrdersMap = new Map<string, number>(); // Map to track set orders for unique exercise and date combinations

        const exerciseMappings = {
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
            "Dumbbell Shoulder Press": "Overhead Press (Dumbbell)",
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

        fitBodData.forEach((entry) => {
            const exerciseKey = `${entry.Date.substring(0, 10)}_${entry.Exercise}`; // Unique key for each exercise and date

            if (!setOrdersMap.has(exerciseKey)) {
                setOrdersMap.set(exerciseKey, 1); // Initialize the set order for a new exercise on a specific date
            }

            const setOrder = setOrdersMap.get(exerciseKey)!; // Get the set order for this exercise and date
            setOrdersMap.set(exerciseKey, setOrder + 1); // Increment set order for the next entry


            if (exerciseMappings[entry.Exercise]) {
                entry.Exercise = exerciseMappings[entry.Exercise];
            }

            hevyData.push({
                Date: entry.Date.substring(0, 19),
                "Workout Name": "Workout on: " + moment(entry.Date).format('YYYY-MM-DD'),
                "Exercise Name": entry.Exercise,
                "Set Order": setOrder,
                Weight: (parseFloat(entry['Weight(kg)']) * parseInt(entry.multiplier)),
                "Weight Unit": "kg",
                Reps: parseInt(entry.Reps),
                RPE: null,
                Distance: null,
                "Distance Unit": null,
                Seconds: 0,
                Notes: null,
                "Workout Notes": null,
                "Workout Duration": "30m",
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

        console.log(csv)
        return csv;
    }

    csvJSON(csv: string): any[] {
        var lines = csv.split("\n");

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
