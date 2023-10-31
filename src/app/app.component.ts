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

        fitBodData.forEach((entry) => {
            const exerciseKey = `${entry.Date.substring(0, 10)}_${entry.Exercise}`; // Unique key for each exercise and date

            if (!setOrdersMap.has(exerciseKey)) {
                setOrdersMap.set(exerciseKey, 1); // Initialize the set order for a new exercise on a specific date
            }

            const setOrder = setOrdersMap.get(exerciseKey)!; // Get the set order for this exercise and date
            setOrdersMap.set(exerciseKey, setOrder + 1); // Increment set order for the next entry

            switch (entry.Exercise) {
                case "Barbell Incline Bench Press":
                    entry.Exercise = "Incline Bench Press (Barbell)";
                    break;
                case "Dumbbell Incline Bench Press":
                    entry.Exercise = "Incline Bench Press (Dumbbell)";
                    break;
                case "Smith Machine Incline Bench Press":
                    entry.Exercise = "Incline Bench Press (Smith Machine)";
                    break;
                case "Smith Machine Bench Press":
                    entry.Exercise = "Bench Press (Smith Machine)";
                    break;
                case "Dumbbell Bench Press":
                    entry.Exercise = "Bench Press (Dumbbell)";
                    break;
                case "Barbell Bench Press":
                    entry.Exercise = "Bench Press (Barbell)";
                    break;
                case "Machine Bench Press":
                    entry.Exercise = "Chest Press (Machine)";
                    break;
                case "Dumbbell Decline Bench Press":
                    entry.Exercise = "Decline Bench Press (Dumbbell)";
                    break;
                case "Barbell Decline Bench Press":
                    entry.Exercise = "Decline Bench Press (Barbell)";
                    break;
                case "Standing Dumbbell Shoulder Press":
                case "Dumbbell Shoulder Press":
                    entry.Exercise = "Overhead Press (Dumbbell)";
                    break;
                case "Seated Barbell Shoulder Press":
                    entry.Exercise = "Seated Overhead Press (Barbell)";
                    break;
                case "Machine Shoulder Press":
                    entry.Exercise = "Seated Shoulder Press (Machine)";
                    break;
                case "Barbell Shoulder Press":
                    entry.Exercise = "Overhead Press (Barbell)";
                    break;
                case "Smith Machine Overhead Shoulder Press":
                    entry.Exercise = "Overhead Press (Smith Machine)";
                    break;
                case "Dumbbell Skullcrusher":
                    entry.Exercise = "Skullcrusher (Dumbbell)";
                    break;
                case "EZ-Bar Skullcrusher":
                    entry.Exercise = "Skullcrusher (Barbell)";
                    break;
                case "Skullcrusher":
                    entry.Exercise = "Skullcrusher (Dumbbell)";
                    break;
                case "Lat Pulldown":
                    entry.Exercise = "Lat Pulldown (Cable)";
                    break;
                case "Machine Fly":
                    entry.Exercise = "Chest Fly (Machine)";
                    break;
                case "Machine Rear Delt Fly":
                case "Machine Reverse Fly":
                    entry.Exercise = "Rear Delt Reverse Fly (Machine)";
                    break;
                case "Machine Leg Press":
                    entry.Exercise = "Leg Press (Machine)";
                    break;
                case "Back Squat":
                    entry.Exercise = "Squat (Barbell)";
                    break;
                case "Pause Back Squat":
                    entry.Exercise = "Pause Squat (Barbell)";
                    break;
                case "Dumbbell Sumo Squat":
                    entry.Exercise = "Sumo Squat (Dumbbell)";
                    break;
                case "Kettlebell Sumo Squat":
                    entry.Exercise = "Sumo Squat (Kettlebell)";
                    break;
                case "Leg Extension":
                    entry.Exercise = "Leg Extension (Machine)";
                    break;
                case "Seated Leg Curl":
                    entry.Exercise = "Seated Leg Curl (Machine)";
                    break;
                case "Leg Curl":
                    entry.Exercise = "Lying Leg Curl (Machine)";
                    break;
                case "Machine Leg Press":
                    entry.Exercise = "Leg Press (Machine)";
                    break;
                case "EZ-Bar Curl":
                case "Close-Grip EZ-Bar Curl":
                    entry.Exercise = "EZ Bar Biceps Curl";
                    break;
                case "Cable Rope Tricep Extension":
                case "Cable Tricep Extension":
                    entry.Exercise = "Triceps Rope Pushdown";
                    break;
                case "Triceps Pressdown":
                    entry.Exercise = "Triceps Pushdown";
                    break;
                case "Deadlift":
                    entry.Exercise = "Deadlift (Barbell)";
                    break;
                case "Romanian Deadlift":
                    entry.Exercise = "Romanian Deadlift (Barbell)";
                    break;
                case "Dumbbell Romanian Deadlift":
                    entry.Exercise = "Romanian Deadlift (Dumbbell)";
                    break;
                case "Kettlebell Sumo Squat":
                    entry.Exercise = "Sumo Squat (Kettlebell)";
                    break;
                case "Low Cable Chest Fly":
                    entry.Exercise = "Low Cable Fly Crossovers";
                    break;
                case "Cable Crossover Fly":
                    entry.Exercise = "Cable Fly Crossovers";
                    break;
                case "Dumbbell Incline Fly":
                    entry.Exercise = "Incline Chest Fly (Dumbbell)";
                    break;
                case "Dumbbell Bicep Curl":
                    entry.Exercise = "Bicep Curl (Dumbbell)";
                    break;
                case "Cable Bicep Curl":
                    entry.Exercise = "Bicep Curl (Cable)";
                    break;
                case "Barbell Curl":
                    entry.Exercise = "Bicep Curl (Barbell)";
                    break;
                case "Dumbbell Preacher Curl":
                    entry.Exercise = "Preacher Curl (Dumbbell)";
                    break;
                case "Preacher Curl":
                    entry.Exercise = "Preacher Curl (Barbell)";
                    break;
                case "Machine Preacher Curl":
                    entry.Exercise = "Preacher Curl (Machine)";
                    break;
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
