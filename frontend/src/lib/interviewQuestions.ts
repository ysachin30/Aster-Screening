export type QuestionKind = "gif" | "satellite" | "differentiability" | "text";

export type McqOption = {
  id: string;
  label: string;
};

export type QuestionPartMcq = {
  part: number;
  options: McqOption[];
  correct_option_id: string;
};

export type Question = {
  id: number;
  kind: QuestionKind;
  question: string;
  context: string;
  hints: string[];
  answer: string;
  format: "objective";
  options?: McqOption[];
  correct_option_id?: string;
  partMcq?: QuestionPartMcq[];
};

export const Q2_PART_1 =
  "Part 1: Explain verbally how a satellite stays in orbit around a celestial body. Discuss the forces acting on it, specifically their directions.";
export const Q2_PART_2 =
  "Part 2: The satellite is already in orbit at the position shown. If its forward velocity suddenly becomes zero, select the best option and briefly explain why.";
export const Q2_PART_3 =
  "Part 3: The satellite is already in orbit at the position shown. If the gravitational force acting on it suddenly becomes zero, select the best option and briefly explain why.";

export const getQ2PartText = (part: number) => {
  if (part === 1) return Q2_PART_1;
  if (part === 2) return Q2_PART_2;
  return Q2_PART_3;
};

export function getSegmentMcq(question: Question, part: number) {
  if (question.partMcq?.length) {
    const entry = question.partMcq.find((item) => item.part === part);
    if (entry) {
      return { options: entry.options, correct_option_id: entry.correct_option_id };
    }
  }
  return {
    options: question.options ?? [],
    correct_option_id: question.correct_option_id ?? "",
  };
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    kind: "gif",
    format: "objective",
    question: "A book is placed on a table and remains at rest. What causes the normal force acting on the book?",
    context: "",
    hints: [],
    answer:
      "The normal force arises from electromagnetic repulsion between electron clouds in the contacting surfaces.",
    options: [
      { id: "A", label: "The weight of the book pushing downward on the table" },
      { id: "B", label: "Electromagnetic repulsion between electron clouds at the contact surface" },
      { id: "C", label: "Gravitational attraction between the book and the table" },
      { id: "D", label: "Air pressure pushing upward from below" },
    ],
    correct_option_id: "B",
  },
  {
    id: 2,
    kind: "satellite",
    format: "objective",
    question: `${Q2_PART_1}\n\n${Q2_PART_2}\n\n${Q2_PART_3}`,
    context: "",
    hints: [],
    answer:
      "Part 1: gravity inward, velocity tangential. Part 2: radial fall inward. Part 3: straight-line motion tangent to the orbit.",
    partMcq: [
      {
        part: 1,
        options: [
          { id: "A", label: "Gravity points inward and velocity is tangential to the orbit" },
          { id: "B", label: "Gravity points tangentially and velocity points inward" },
          { id: "C", label: "No forces act on the satellite in orbit" },
          { id: "D", label: "Only electromagnetic forces keep the satellite in orbit" },
        ],
        correct_option_id: "A",
      },
      {
        part: 2,
        options: [
          { id: "A", label: "It continues in a perfect circle at the same radius" },
          { id: "B", label: "It falls straight toward the central body along the radial direction" },
          { id: "C", label: "It moves in a straight line tangent to the orbit" },
          { id: "D", label: "It stops instantly and remains fixed in space" },
        ],
        correct_option_id: "B",
      },
      {
        part: 3,
        options: [
          { id: "A", label: "It falls straight toward the central body" },
          { id: "B", label: "It spirals outward away from the central body" },
          { id: "C", label: "It continues in a straight line along its instantaneous velocity direction" },
          { id: "D", label: "It stops immediately with zero motion" },
        ],
        correct_option_id: "C",
      },
    ],
  },
  {
    id: 3,
    kind: "differentiability",
    format: "objective",
    question: "If a function is continuous but not differentiable at a point, what does that mean geometrically?",
    context: "",
    hints: [],
    answer: "There is no unique tangent line at that point; the graph has a corner, cusp, or vertical tangent.",
    options: [
      { id: "A", label: "The function has a jump discontinuity at that point" },
      { id: "B", label: "There is no unique tangent line; the graph has a corner or kink" },
      { id: "C", label: "The function value is undefined at that point" },
      { id: "D", label: "The slope is exactly zero everywhere near that point" },
    ],
    correct_option_id: "B",
  },
  {
    id: 4,
    kind: "text",
    format: "objective",
    question:
      "A cube is painted on all six faces and then cut into 27 equal smaller cubes. How many small cubes will have exactly two painted faces?",
    context: "",
    hints: [],
    answer: "12 small cubes have exactly two painted faces.",
    options: [
      { id: "A", label: "6" },
      { id: "B", label: "8" },
      { id: "C", label: "12" },
      { id: "D", label: "18" },
    ],
    correct_option_id: "C",
  },
  {
    id: 5,
    kind: "text",
    format: "objective",
    question:
      "Four people need to cross a bridge at night.\n\n"
      + "Each person walks at a different speed:\n"
      + "A = 1 minute\n"
      + "B = 2 minutes\n"
      + "C = 5 minutes\n"
      + "D = 10 minutes\n\n"
      + "When two people cross together, they move at the slower person's speed.\n\n"
      + "The torch must always be carried during a crossing.\n\n"
      + "What is the minimum total time required for everyone to cross?",
    context: "",
    hints: [],
    answer: "Minimum total crossing time is 17 minutes.",
    options: [
      { id: "A", label: "15 minutes" },
      { id: "B", label: "17 minutes" },
      { id: "C", label: "20 minutes" },
      { id: "D", label: "22 minutes" },
    ],
    correct_option_id: "B",
  },
];
