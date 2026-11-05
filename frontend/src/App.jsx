
import { useState,useEffect } from "react";
import "./App.css";

export default function App() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [visitType, setVisitType] = useState("New Patient");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [booking, setBooking] = useState(null);
  
  const [waitingInfo, setWaitingInfo] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [allBookings, setAllBookings] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  async function fetchAllBookings() {
  setAdminLoading(true);

  try {
    const response = await fetch(
      "http://localhost:5000/api/bookings"
    );

    const data = await response.json();

    if (response.ok) {
      setAllBookings(data);
    } else {
      setMessage("Unable to load bookings");
    }
  } catch (error) {
    setMessage("Backend connection failed");
  } finally {
    setAdminLoading(false);
  }
}



async function updateBookingStatus(id, status) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/bookings/${id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Status update failed");
    }

    if (data.emailSent) {
      setMessage("Status updated! Email sent successfully.");
    } else {
      setMessage("Status updated, but email was not sent.");
    }

    await fetchAllBookings();

  } catch (error) {
    setMessage(error.message);
  }
}



  function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  
  async function fetchWaitingInfo(token) {
    try {
      const response = await fetch(
        `http://localhost:5000/api/bookings/${token}/waiting`
      );

      const data = await response.json();

      if (response.ok) {
        setWaitingInfo(data);
      } else {
        setWaitingInfo(null);
        console.log(data.message);
      }
    } catch (error) {
      console.error("Waiting info error:", error);
      setWaitingInfo(null);
    }
  }

  
    
    useEffect(() => {
      if (!booking?.token) return;

      const interval = setInterval(async () => {
        fetchWaitingInfo(booking.token);

        try {
          const response = await fetch("http://localhost:5000/api/bookings");
          const data = await response.json();

          if (response.ok) {
            const latestBooking = data.find(
              (item) => item.token === booking.token
            );

            if (latestBooking) {
              setBooking(latestBooking);
            }
          }
        } catch (error) {
          console.error("Live booking update error:", error);
        }
      }, 10000);

      return () => clearInterval(interval);
    }, [booking?.token]);




  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setBooking(null);

    const bookingData = {
      name,
      age: Number(age),
      gender,
      phone,
      email,
      reason,
      specialist,
      date,
      time,
      visitType
    };

    try {
      const response = await fetch(
        "http://localhost:5000/api/bookings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(bookingData)
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Booking failed");
      }

      setBooking(data.booking);
      await fetchWaitingInfo(data.booking.token);
      setMessage(data.message);
    } catch (error) {
      setMessage(
        error.message === "Failed to fetch"
          ? "Backend connection failed. Check whether your server is running."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setAge("");
    setGender("");
    setPhone("");
    setEmail("");
    setReason("");
    setSpecialist("");
    setDate("");
    setTime("");
    setVisitType("New Patient");
    setBooking(null);
    setMessage("");
  }

  return (
    <>
      
      <nav className="navbar">
        <h2>Queue Less</h2>

        <button
          type="button"
          onClick={() => {
            const next = !showAdmin;
            setShowAdmin(next);

            if (next) {
              fetchAllBookings();
            }
          }}
        >
          {showAdmin ? "Patient Booking" : "Admin Dashboard"}
        </button>

        <span>Smart Clinic Booking</span>
      </nav>


      <main className="container">

        
        {showAdmin && (
          <section className="booking-card">
            <h1>Admin Dashboard</h1>
            <p>Manage patient appointments and queue status.</p>

            <button type="button" onClick={fetchAllBookings}>
              Refresh Bookings
            </button>

            {adminLoading && <p>Loading bookings...</p>}

            {!adminLoading && allBookings.length === 0 && (
              <p>No bookings found.</p>
            )}

            {allBookings.map((item) => (
              <div className="admin-patient-card" key={item._id}>
                <h3 className="admin-token">Token #{item.token}</h3>
                <p><strong>Patient:</strong> {item.name}</p>
                <p><strong>Specialist:</strong> {item.specialist}</p>
                <p><strong>Date:</strong> {item.date}</p>
                <p><strong>Time:</strong> {item.time}</p>
                <p className="admin-status">
  <strong>Status:</strong>
  <span className={`status-${item.status.toLowerCase()}`}>
    {item.status}
  </span>
</p>

                <label className="admin-label">Update Status</label>

<select
  className="admin-status-select"
  value={item.status}
  onChange={(e) =>
    updateBookingStatus(item._id, e.target.value)
  }
>
  <option value="Waiting">Waiting</option>
  <option value="Consulting">Consulting</option>
  <option value="Completed">Completed</option>
</select>
              </div>
            ))}
          </section>
        )}

        {!showAdmin && (
        <>

        <h1>Book Your Clinic Token</h1>



        <p className="subtitle">
          Less waiting. Better planning. Better care.
        </p>

        {!booking && (

          <form className="booking-card" onSubmit={handleSubmit}>
            <label>Patient Full Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="two-columns">
              <div>
                <label>Age</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Enter age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">
                    Prefer not to say
                  </option>
                </select>
              </div>
            </div>

            <label>Phone Number</label>
            <input
              type="tel"
              placeholder="Enter phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              pattern="[0-9]{10}"
              title="Enter a 10-digit phone number"
              required
            />

            <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

            <label>Reason for Appointment</label>
            <textarea
              placeholder="Enter your symptoms or reason for visit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            <label>Choose Specialist</label>
            <select
              value={specialist}
              onChange={(e) => setSpecialist(e.target.value)}
              required
            >
              <option value="">Select a specialist</option>
              <option value="General Physician">
                General Physician
              </option>
              <option value="Cardiologist">Cardiologist</option>
              <option value="Dermatologist">Dermatologist</option>
              <option value="Pediatrician">Pediatrician</option>
              <option value="Orthopedician">Orthopedician</option>
              <option value="Gynecologist">Gynecologist</option>
              <option value="ENT Specialist">ENT Specialist</option>
              <option value="Dentist">Dentist</option>
            </select>

            <label>Visit Type</label>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value)}
              required
            >
              <option value="New Patient">New Patient</option>
              <option value="Follow-up">Follow-up</option>
            </select>

            <div className="two-columns">
              <div>
                <label>Appointment Date</label>
                <input
                  type="date"
                  min={getTodayDate()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>Preferred Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {message && (
              <p className="error-message">{message}</p>
            )}

            <button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book My Token"}
            </button>
          </form>
        )}

        
{booking && (
  <div className="booking-card result">
    <div className="success-heading">
      <span className="success-icon">✓</span>
      <h2>Booking Confirmed!</h2>
      <p>Your appointment has been successfully booked.</p>
    </div>

    <div className="token-number">
      <span>YOUR TOKEN NUMBER</span>
      <strong>#{booking.token}</strong>
    </div>

    {waitingInfo && (
      <div className="waiting-info">
        <h3>Live Queue Status</h3>

        <div className="queue-grid">
          <div className="queue-box">
            <span>Patients Ahead</span>
            <strong>{waitingInfo.patientsAhead}</strong>
          </div>

          <div className="queue-box">
            <span>Estimated Waiting</span>
            <strong>
              {booking.status === "Completed"
                ? "Completed"
                : waitingInfo.estimatedMinutes === 0
                ? "Your turn is next!"
                : `${waitingInfo.estimatedMinutes} min`}
            </strong>
          </div>
        </div>
      </div>
    )}

    <div className="patient-details">
      <h3>Appointment Details</h3>

      <p><strong>Patient:</strong> {booking.name}</p>
      <p><strong>Age:</strong> {booking.age}</p>
      <p><strong>Gender:</strong> {booking.gender}</p>
      <p><strong>Specialist:</strong> {booking.specialist}</p>
      <p><strong>Reason:</strong> {booking.reason}</p>
      <p><strong>Visit Type:</strong> {booking.visitType}</p>
      <p><strong>Date:</strong> {booking.date}</p>
      <p><strong>Time:</strong> {booking.time}</p>

      <p>
        <strong>Status:</strong>{" "}
        <span className={`status-badge ${booking.status.toLowerCase()}`}>
          {booking.status}
        </span>
      </p>
    </div>

    <button type="button" onClick={resetForm}>
      Book Another Appointment
    </button>
  </div>
)}

          </>
        )}
      </main>
    </>
  );
}
