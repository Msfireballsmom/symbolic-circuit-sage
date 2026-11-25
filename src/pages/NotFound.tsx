import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import PublicPage from "@/components/PublicPage";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <PublicPage title="Page not found">
      <p>The page you requested does not exist. Return to Circuit Sage using the link above.</p>
    </PublicPage>
  );
};

export default NotFound;
