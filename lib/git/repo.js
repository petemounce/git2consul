var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var util = require('util');

var logger = require('./utils/logging.js');

var branch_manager = require('./branch.js');

exports = function(repo_config, cb) {

  function GitManager() {}

  GitManager.prototype.getRepoName = function() {
    return repo_config.name;
  };

  GitManager.prototype.getBranchNames = function() {
    return repo_config.branches;
  };

  GitManager.prototype.getBranchManager = function(branch_name) {
    return branch_managers[branch_name];
  };

  logger.info(util.inspect(repo_config));

  var branches = {};

  var this_obj = new GitManager();
  var branch_count = 0;

  if (!repo_config.branches || repo_config.branches.length === 0) return cb('No branches specified.');

  var unique_branches = _.uniq(repo_config.branches);
  if (unique_branches.length !== repo_config.branches.length) 
    return cb("Duplicate name found in branches for repo " + repo_config.name + ": " + repo_config.branches);

  // Build the root_directory, if necessary
  mkdirp(config.local_store, function(err) {

    if (err) return cb('Failed to create root_directory for git manager: ' + err);

    // Each branch needs a copy of config.local_store
    repo_config.local_store = config.local_store;

    repo_config.branches.forEach(function(branch) {
      branch_manager.manageBranch(repo_config, branch, function(err, bm) {
        if (err) {
          // The most common reason for this to fail is due to a failed clone or otherwise corrupted git cache.  Try
          // killing the branch dir before failing so that the next start will have a clean slate.
          return branch_manager.purgeBranchCache(repo_config, branch, function() {
            cb('Failed to create manager for branch ' + branch + ': ' + err);
          });
        }

        ++branch_count;

        // Store the branch manager for future lookups
        logger.info("Storing branch manager for %s", bm.getBranchName());
        branch_managers[bm.getBranchName()] = bm;

        if (branch_count === repo_config.branches.length) {
          // We have a branch manager for each branch.
          logger.debug('Branch managers initialized');

          if (daemon && repo_config.hooks) {
            // Init hooks
            var errs = [];

            repo_config.hooks.forEach(function(hook) {
              try {
                var hook_provider = hook_providers[hook.type];
                if (!hook_provider) {
                  return errs.push("Invalid hook type " + hook.type);
                }

                hook_provider.init(hook, this_obj, mock);
              } catch (e) {
                return errs.push("Hook configuration failed due to " + e);
              }
            });

            if (errs.length > 0) return cb(errs);
          }

          cb(null, this_obj);
        }
      });
    });
  });

};

/**
 * Given an array of repo configurations, initialize a git_manager for each.  If any of the
 * git_managers are incorrectly specified, the callback will return a list of all errors seen.
 * The second parameter of the callback will contain an array of git_managers (not necessarily
 * in the order provided in the repos parameter).
 */
exports.manageRepos = function(config, cb) {

  if (!config) return cb('No config provided');

  var repos = config.repos;
  if (!repos || !repos.length || !(repos.length > 0)) return cb('No array of repo configs provided');

  var pending_git_managers = repos.length;
  var errors = [];
  var git_managers = [];

  var repo_names = _.pluck(repos, 'name');
  var unique_names = _.uniq(repo_names);
  if (unique_names.length !== repos.length) return cb("Duplicate name found in repos " + repo_names);

  repos.forEach(function(repo_config) {
    exports.manageRepo(config, repo_config, function(err, git_manager) {
      if (err) logger.error('Got error %s', err);

      if (err) errors.push(err);
      else git_managers.push(git_manager);

      --pending_git_managers;
      if (pending_git_managers === 0) {
        return cb(errors.length === 0 ? null : errors, git_managers);
      }
    });
  });
};