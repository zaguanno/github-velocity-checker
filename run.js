import { Octokit } from "@octokit/rest";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { throttling } from "@octokit/plugin-throttling";
import * as dotenv from 'dotenv'
import { createRequire } from "module";
import fs from 'fs'

const require = createRequire(import.meta.url);
const config = require("./config.json");
const githubData = require("./github-data-joint.json");

dotenv.config()
const start = new Date()
const hrstart = process.hrtime()
const simulateTime = 5
const allowedMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const allowedYears = [2022, 2023, 2024]

const month = parseInt(process.argv[2].split('month=')[1])
const year = parseInt(process.argv[3].split('year=')[1])

const { developers, repositories } = config

if (!allowedMonths.includes(month) || !allowedYears.includes(year)) {
  throw new Error(`wrong arguments for month: ${month} and year: ${year}`)
}

const allMergedPrsByRepo = {}
const pullRequestsByDevs = {}
const reviewsByDevs = {}

const MyOctokit = Octokit.plugin(throttling);
const octokit = new MyOctokit({
  auth: process.env.GIT_HUB_TOKEN || '',
  throttle: {
    onRateLimit: (retryAfter, options, octokit, retryCount) => {
      octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`,
      );

      if (retryCount < 1) {
        // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onSecondaryRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
      );
      //retry up to twice
      if (options.request.retryCount <= 2) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    //fallbackSecondaryRateRetryAfter: 30,
    //retryAfterBaseValue: 30,
  }
});

const calCycleTimeToString = (merged_at, created_at) => Number((new Date(merged_at) - new Date(created_at)) / (1000 * 60 * 60)).toFixed(2) 

async function calReviewsByPullRequest (pullId, repo, author, owner) {
  // count review only once for every unique reviewer and ignore author's self review/comment
  const reviewsAlreadyCounted = [author]
  //console.log(pullId, repo, author, owner);
  const { data } = await octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner: owner,
    repo: repo,
    pull_number: pullId,
    per_page: 100
  }).then((d) => {

    for (const {user} of d) {
      if (!developers.includes(user?.login) || reviewsAlreadyCounted.includes(user?.login)) {
        continue
      }

      reviewsAlreadyCounted.push(user.login)

      if (reviewsByDevs[user.login]) {
        reviewsByDevs[user.login] += 1
      } else {
        reviewsByDevs[user.login] = 1
      }
    }
  });
}

function isRelevantPull(pull) {
  if (!pull.merged_at || !developers.includes(pull.user?.login)) { return false; }
  const merged_at = new Date(pull.merged_at);
  if (!(merged_at.getFullYear() == year && merged_at.getMonth() == month)) { return false; }
  return true;
}

function exitBeforeDate(pull) {
  //console.log(year,month,pull.merged_at);
  if (!pull.merged_at) { return false; }
  const merged_at = new Date(pull.merged_at);
  if (merged_at.getFullYear() < year) { return true; }
  if ((merged_at.getFullYear() <= year && merged_at.getMonth() < month-1)) { return true; }
}

function ifPullMatchesDate(pull) {
  const merged_at = new Date(pull.merged_at);
  if (merged_at.getFullYear() == year && merged_at.getMonth() == month) { return true; }
}

async function calVelocityByRepo (repo, owner) {
  allMergedPrsByRepo[owner+":"+repo] = []
  const { data } = await octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
    owner: owner,
    repo: repo,
    state: "closed",
    per_page: 100
  }, (response, done) => {
    //console.log(response.data);
    if (response.data.find((pull) => exitBeforeDate(pull))) {
      done();
    }
    return response.data;
  }).then((d) => {
    //console.log(owner, repo, d.length);
    const filteredPullRequests = d.filter(isRelevantPull);
    //console.log(owner, repo, filteredPullRequests.length);
    filteredPullRequests.forEach(({ user, number, merged_at, created_at }) => {
      const cycleTime = calCycleTimeToString(merged_at, created_at)
      allMergedPrsByRepo[owner+":"+repo].push({ author: user.login, pullId: number, cycleTime: `${cycleTime} hrs` })
      if (pullRequestsByDevs[user.login]) {
        const newTotalPr = pullRequestsByDevs[user.login].totalPrs + 1
        // calculate avg cycle time
        pullRequestsByDevs[user.login].avgCycleTime = parseInt((pullRequestsByDevs[user.login].avgCycleTime * pullRequestsByDevs[user.login].totalPrs + parseInt(cycleTime)) / newTotalPr)
        // update total prs merged by this dev
        pullRequestsByDevs[user.login].totalPrs = newTotalPr
      } else {
        pullRequestsByDevs[user.login] = {
          totalPrs: 1,
          avgCycleTime: parseInt(cycleTime)
        }
      }
    });
  });
}

setTimeout(async () => {
  try {
    await Promise.allSettled(Object.keys(repositories).map(async owner => {
      await Promise.allSettled(repositories[owner].map(async (repo) => await calVelocityByRepo(repo, owner)))
    }))

    await Promise.allSettled(Object.keys(allMergedPrsByRepo).map(async ownerrepo => {
      const [owner, repo] = ownerrepo.split(":");
      await Promise.allSettled(allMergedPrsByRepo[owner+":"+repo].map(async ({ author, pullId }) => await calReviewsByPullRequest(pullId, repo, author, owner)))
    }))
  } catch (err) {
    throw err
  }

  // execution time simulated with setTimeout function
  const end = new Date() - start
  const hrend = process.hrtime(hrstart)

  console.log('allMergedPrsByRepo', allMergedPrsByRepo)
  console.log('PRs', pullRequestsByDevs)
  console.log('Reviews', reviewsByDevs)

  console.info('Execution time: %dms', end)
  console.info('Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000)

  if (process.env.EXPORT_CSV === 'true') {
    let thisRun = {};

    for (const dev of developers) {
      thisRun[dev] = {totalPrs: pullRequestsByDevs[dev]?.totalPrs || 0, totalReviews: reviewsByDevs[dev] || 0, avgCycleTime: pullRequestsByDevs[dev]?.avgCycleTime};
    }

    if(!githubData[year]) { githubData[year] = {}; }
    if(!githubData[year][month]) { githubData[year][month] = {}; }
    githubData[year][month] = thisRun;

    let data1 = `Name,Year,Month,PR #,Review #,Average Cycle Time (hours)\r\n`;

    Object.entries(githubData).forEach(([y,months]) => {
      Object.entries(months).forEach(([m,devs]) => {
        Object.entries(devs).forEach(([d,devValues]) => {
          const row = [d, y, parseInt(m) + 1, devValues.totalPrs, devValues.totalReviews, devValues.avgCycleTime].join(',') || 0;
          data1 += row + "\r\n";
        })
      })
    })

    fs.writeFile(`github-data-joint.json`, JSON.stringify(githubData), "utf-8", (err) => {
      if (err) console.log(err);
      else console.log("json saved");
    });

    fs.writeFile(`github-data-joint.csv`, data1, "utf-8", (err) => {
      if (err) console.log(err);
      else console.log("Data saved");
    });
  }
}, simulateTime)
