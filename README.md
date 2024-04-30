## Run Script
`npm run velocity:print month=0 year=2023` month has to be 0-11 and year has to be 2022-2024
### Important notes

- This script only pulls the first 200 records of each repo
- Only PRs merged within the month are included in each user's total pr count
- Non-merged PRs are excluded (closed, open PRs)
- Any reviews for PRs not created by the devs specified in config are not included
