import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  reason?: string;
  remainingSolves?: number;
}

const UpgradeModal = ({ open, onClose, reason, remainingSolves }: UpgradeModalProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-2">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-foreground">
            {remainingSolves === 0 ? "Daily Solve Limit Reached" : "Upgrade Required"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason || "You've used all your solves for today. Upgrade to keep solving!"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onClose();
              navigate("/pricing");
            }}
          >
            <Crown className="w-4 h-4" />
            View Plans
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
