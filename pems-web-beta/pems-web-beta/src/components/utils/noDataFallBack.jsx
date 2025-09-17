import icon from "../../assets/noData_icon.png";

export const NoDataResponse = ({ message }) => (
  <div
    style={{
      display: "flex",
      gap: "20px",
      alignItems: "center", 
    }}
  >
    <img
      src={icon}
      alt="No data"
      style={{
        width: "100px",
        height: "100px",
        opacity: 0.7, 
      }}
    />
    <span
      style={{
        fontSize: "1.25rem", 
        fontWeight: 500,     
        lineHeight: 1,       
      }}
    >
      {message}
    </span>
  </div>
);