## Setup
1. Copy `.env.example` to `.env`
2. To generate `GIT_HUB_TOKEN` in the `.env` file:
   1. Go to your Github Account Settings > Developer Settings (at the bottom of the menu) > Personal access tokens > 
   Tokens (classic)
   2. Generate a new (classic) token
   3. Add only the following permissions to the token: `read:audit_log, read:gpg_key, read:org, read:project, 
   read:ssh_signing_key, read:user, repo, user:email`
3. `config.json` stores all relevant repos and developers
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
