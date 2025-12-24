import { CTRChart } from "../CTRChart";

// todo: remove mock functionality
const mockData = [
  { date: "Dec 1", variantA: 5.2, variantB: 4.8 },
  { date: "Dec 2", variantA: 5.8, variantB: 5.1 },
  { date: "Dec 3", variantA: 6.4, variantB: 5.5 },
  { date: "Dec 4", variantA: 7.1, variantB: 5.8 },
  { date: "Dec 5", variantA: 7.8, variantB: 6.0 },
  { date: "Dec 6", variantA: 8.2, variantB: 6.1 },
  { date: "Dec 7", variantA: 8.5, variantB: 6.2 },
];

export default function CTRChartExample() {
  return <CTRChart data={mockData} />;
}
