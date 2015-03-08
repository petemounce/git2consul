@git2consul

Feature: Ensure that proper infrastructure for the tests is setup

  Scenario: All servers are running
    Given The consulserver1 box is online
    Given The consulserver2 box is online
    Given The consulserver3 box is online
    Given The git integration repo is initialized
    Given The consulserver1 box has a git2consul config

  Scenario Outline: All servers are running git2consul
    Then The <box_name> box is running git2consul
    Then The <box_name> box has 2 known peers
    Examples:
      | box_name        |
      | consulserver1   |
      | consulserver2   |
      | consulserver3   |

  Scenario Outline: A config change should restart the git2consul service
    Given We know git2consul service status for <box_name>
    And Given A configuration change to git2consul for <box_name>
    Then The <box_name> box should restart the git2consul service
    Examples:
      | box_name        |
      | consulserver1   |
      | consulserver2   |
      | consulserver3   |