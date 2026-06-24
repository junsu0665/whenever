/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const appGroups =
    config.ios?.entitlements?.['com.apple.security.application-groups'] ?? ['group.com.wenever.app'];

  return {
    type: 'widget',
    name: 'WeneverTimetableWidget',
    displayName: '웨네버 시간표',
    bundleIdentifier: '.timetable-widget',
    deploymentTarget: '16.0',
    colors: {
      $accent: '#2FA66B',
      $widgetBackground: '#FFFFFF',
      primary: '#2FA66B',
      primaryDark: '#00845E',
      primarySoft: '#E9F8F0',
      surfaceAlt: '#F7F8FA',
      text: '#151A1F',
      muted: '#58636D',
      border: '#E7EAEE',
    },
    entitlements: {
      'com.apple.security.application-groups': appGroups,
    },
  };
};
