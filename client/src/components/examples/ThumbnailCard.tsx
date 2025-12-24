import { ThumbnailCard } from "../ThumbnailCard";

export default function ThumbnailCardExample() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <ThumbnailCard
        id="1"
        imageUrl="https://picsum.photos/seed/thumb1/640/360"
        title="10 Tips for Better Videos"
        ctr={8.5}
        views={12500}
        status="winner"
        onClick={() => console.log("Clicked thumbnail 1")}
      />
      <ThumbnailCard
        id="2"
        imageUrl="https://picsum.photos/seed/thumb2/640/360"
        title="How I Made $10k This Month"
        ctr={6.2}
        views={8300}
        status="testing"
        onClick={() => console.log("Clicked thumbnail 2")}
      />
      <ThumbnailCard
        id="3"
        imageUrl="https://picsum.photos/seed/thumb3/640/360"
        title="Ultimate Camera Guide 2024"
        status="draft"
        onClick={() => console.log("Clicked thumbnail 3")}
      />
      <ThumbnailCard
        id="4"
        imageUrl="https://picsum.photos/seed/thumb4/640/360"
        title="You Won't Believe This..."
        ctr={4.1}
        views={3200}
        status="archived"
        onClick={() => console.log("Clicked thumbnail 4")}
      />
    </div>
  );
}
