// What the student sees. Grades 3–8 are shown to her as Levels 1–6, so nothing on her screens
// reads as "going back to Grade 3". The parent dashboard and the data keep real grades.
export const levelOf = (grade: number) => grade - 2;
export const TOP_LEVEL = levelOf(8);
