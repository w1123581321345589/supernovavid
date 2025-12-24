import { TemplateCard } from "../TemplateCard";

export default function TemplateCardExample() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <TemplateCard
        id="1"
        imageUrl="https://picsum.photos/seed/temp1/640/360"
        name="Bold Impact"
        category="Gaming"
        popularity={95}
        onUse={() => console.log("Using template 1")}
      />
      <TemplateCard
        id="2"
        imageUrl="https://picsum.photos/seed/temp2/640/360"
        name="Clean Minimal"
        category="Tech Reviews"
        popularity={78}
        onUse={() => console.log("Using template 2")}
      />
      <TemplateCard
        id="3"
        imageUrl="https://picsum.photos/seed/temp3/640/360"
        name="Dramatic Glow"
        category="Vlogs"
        popularity={88}
        onUse={() => console.log("Using template 3")}
      />
      <TemplateCard
        id="4"
        imageUrl="https://picsum.photos/seed/temp4/640/360"
        name="Face Forward"
        category="Tutorial"
        onUse={() => console.log("Using template 4")}
      />
    </div>
  );
}
