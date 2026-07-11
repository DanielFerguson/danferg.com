type ProjectModule = {
  frontmatter: {
    highlight?: boolean;
    period?: string;
    title: string;
  };
};

const getProjectStartYear = (period?: string) => {
  const year = period?.match(/\d{4}/)?.[0];

  return year ? Number(year) : Number.NEGATIVE_INFINITY;
};

const getProjectEndYear = (period?: string) => {
  if (period?.toLowerCase().includes("present")) {
    return Number.POSITIVE_INFINITY;
  }

  const years = period?.match(/\d{4}/g);
  const year = years?.at(-1);

  return year ? Number(year) : Number.NEGATIVE_INFINITY;
};

export const compareProjectsByPeriod = (a: ProjectModule, b: ProjectModule) =>
  Number(Boolean(b.frontmatter.highlight)) -
    Number(Boolean(a.frontmatter.highlight)) ||
  getProjectEndYear(b.frontmatter.period) -
    getProjectEndYear(a.frontmatter.period) ||
  getProjectStartYear(b.frontmatter.period) -
    getProjectStartYear(a.frontmatter.period) ||
  a.frontmatter.title.localeCompare(b.frontmatter.title);
