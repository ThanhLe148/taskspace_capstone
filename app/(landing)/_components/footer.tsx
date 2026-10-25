import { Button } from "@/components/ui/button";

export const Footer = () => {
  return (
    <div className="fixed bottom-0 w-full p-2 border-t bg-slate-100">
      <div className="md:max-w-screen-2xl mx-auto flex items-center w-full justify-between">
        
        <div className="space-x-4 md:block md:w-auto flex items-center justify-between w-full">
          <Button size="sm" variant="ghost">
            Privacy Policy
          </Button>
          <Button size="sm" variant="ghost">
            Terms of Service
          </Button>
        </div>
      </div>
    </div>
  );
};
