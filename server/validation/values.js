const allowedCourses = [
  "Computer Basics", "Microsoft Word", "Microsoft Excel", "Graphic Design",
  "Website Development", "Programming", "Digital Skills for Business",
  "Other / Not sure yet", "Other", "Microsoft PowerPoint", "Microsoft Access",
  "Google Workspace", "UI/UX Design", "Video Editing", "HTML and CSS", "JavaScript",
  "Python", "Java", "PHP", "React", "Mobile Application Development",
  "SQL and Database Management", "Power BI", "Digital Marketing", "Networking",
  "Cybersecurity Fundamentals", "Cloud Computing"
];

const allowedModes = ["Individual", "Group", "Online", "Corporate"];
const allowedLevels = ["Beginner", "Intermediate", "Advanced"];
const internshipDepartments = [
  "Software Development", "Web Development", "Mobile Application Development",
  "IT Support and Networking", "Cybersecurity", "Data Analysis and Database Management",
  "UI/UX and Graphic Design", "Digital Marketing", "Business Administration",
  "Project Management", "Research and Innovation", "Digital Education and Training"
];

function requiredText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validDateOrNull(value) {
  if (!value) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

module.exports = { allowedCourses, allowedModes, allowedLevels, internshipDepartments, requiredText, validEmail, clean, validDateOrNull };