import { GeneratePanel } from "../GeneratePanel";

export default function GeneratePanelExample() {
  return (
    <div className="max-w-md">
      <GeneratePanel
        onGenerate={(prompt, count, style) =>
          console.log("Generate:", { prompt, count, style })
        }
      />
    </div>
  );
}
