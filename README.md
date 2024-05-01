## Setup
1. Ensure `GIT_HUB_TOKEN` in the `.env` file is up-to-date
2. `config.json` stores all relevant repos and developers
   1. Currently the script is hardcoded to the `vividseats` org, but the config json is setup to allow repos from 
   others (ie- fanexchange)

## Run Script
`npm run velocity:print month=0 year=2023` month has to be 0-11 and year has to be 2022-2024

## Output

`github-data-joint.json` => This is the persisted data file, ie- the "DB" of the app. This is deserialized at the end 
of the script, the current run writes (or overwrites) that month, and then it's re-serialized. \
`github-data-joint.csv` => This is the output of the `.json` in `.csv` format. This file can be fully copied and pasted 
pasted into the Metrics excel sheet.

### Important notes

- Only PRs merged within the month are included in each user's total pr count
- Non-merged PRs are excluded (closed, open PRs)
- Any reviews for PRs not created by the devs specified in config are not included
