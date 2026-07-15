const DAY_MS = 24 * 60 * 60 * 1000;

const startOfLocalDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const DASHBOARD_DATE_GROUPS = {
  TODAY: "TODAY",
  YESTERDAY: "YESTERDAY",
  LAST_WEEK: "IN THE LAST WEEK",
  OLDER: "OLDER",
};

export const getDashboardDateGroup = (dateValue, nowValue = new Date()) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return DASHBOARD_DATE_GROUPS.OLDER;
  }

  const today = startOfLocalDay(new Date(nowValue));
  const itemDay = startOfLocalDay(date);
  const diffDays = Math.floor((today.getTime() - itemDay.getTime()) / DAY_MS);

  if (diffDays <= 0) {
    return DASHBOARD_DATE_GROUPS.TODAY;
  }
  if (diffDays === 1) {
    return DASHBOARD_DATE_GROUPS.YESTERDAY;
  }
  if (diffDays <= 7) {
    return DASHBOARD_DATE_GROUPS.LAST_WEEK;
  }
  return DASHBOARD_DATE_GROUPS.OLDER;
};

export const groupDashboardItemsByDate = (items, getDateValue) => {
  return items.reduce(
    (groups, item) => {
      const group = getDashboardDateGroup(getDateValue(item));
      groups[group].push(item);
      return groups;
    },
    {
      [DASHBOARD_DATE_GROUPS.TODAY]: [],
      [DASHBOARD_DATE_GROUPS.YESTERDAY]: [],
      [DASHBOARD_DATE_GROUPS.LAST_WEEK]: [],
      [DASHBOARD_DATE_GROUPS.OLDER]: [],
    }
  );
};
