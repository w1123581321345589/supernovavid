import { ABTestComparison } from "../ABTestComparison";

export default function ABTestComparisonExample() {
  return (
    <ABTestComparison
      testId="test-1"
      videoTitle="How to Double Your YouTube Views in 30 Days"
      variantA={{
        id: "a1",
        imageUrl: "https://picsum.photos/seed/vara/640/360",
        ctr: 8.45,
        impressions: 24500,
        clicks: 2070,
      }}
      variantB={{
        id: "b1",
        imageUrl: "https://picsum.photos/seed/varb/640/360",
        ctr: 6.12,
        impressions: 24200,
        clicks: 1481,
      }}
      confidence={97}
      daysRemaining={3}
      onDeclareWinner={(id) => console.log("Winner declared:", id)}
      onExtendTest={() => console.log("Test extended")}
    />
  );
}
