const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();
async function sendQueueLessEmail({ to, subject, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "Queue Less <onboarding@resend.dev>",
      to,
      subject,
      text
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }

  return data;
}

app.use(cors());
app.use(express.json());

const bookingSchema = new mongoose.Schema(
  {
    token: { type: Number, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    reason: { type: String, required: true },
    specialist: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    visitType: { type: String, required: true },
    status: { type: String, default: "Waiting" }
  },
  { timestamps: true }
);

const Booking = mongoose.model("Booking", bookingSchema);

app.get("/", (req, res) => {
  res.json({ message: "Queue Less backend is running!" });
});

app.post("/api/bookings", async (req, res) => {
  try {
    const {
      name, age, gender, phone, email, reason,
      specialist, date, time, visitType
    } = req.body;

    if (
      !name || !age || !gender || !phone ||!email ||
      !reason || !specialist || !date ||
      !time || !visitType
    ) {
      return res.status(400).json({
        message: "Please fill in all fields."
      });
    }

    const lastBooking = await Booking.findOne().sort({ token: -1 });
    const nextToken = lastBooking ? lastBooking.token + 1 : 1;

    const booking = await Booking.create({
      token: nextToken,
      name, age, gender, phone, email, reason,
      specialist, date, time, visitType
    });

   // Send booking confirmation email
let emailSent = false;

try {
  await sendQueueLessEmail({
  to: booking.email,
  subject: "Appointment Confirmed | Queue Less",
  text: `
Hello ${booking.name},

Your clinic appointment has been booked successfully!

Token Number: ${booking.token}
Specialist: ${booking.specialist}
Appointment Date: ${booking.date}
Appointment Time: ${booking.time}
Status: ${booking.status}

Thank you for choosing Queue Less!
  `
});

  emailSent = true;
  console.log("Booking confirmation email sent to:", booking.email);

} catch (emailError) {
  console.error("Email sending failed:", emailError.message);
}

    res.status(201).json({
  message: "Booking created successfully!",
  booking,
  emailSent
});
  } catch (error) {
    console.error("Booking error:", error.message);
    res.status(500).json({
      message: "Unable to save booking."
    });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    console.error("Fetch error:", error.message);
    res.status(500).json({
      message: "Unable to fetch bookings."
    });
  }
});

app.get("/api/bookings/:token/waiting", async (req, res) => {
  try {
    const token = Number(req.params.token);

    const currentBooking = await Booking.findOne({ token });

    if (!currentBooking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    const patientsAhead = await Booking.countDocuments({
      token: { $lt: token },
      status: "Waiting",
      date: currentBooking.date,
      specialist: currentBooking.specialist
    });

    const averageMinutes = 8;
    const estimatedMinutes = patientsAhead * averageMinutes;

        res.json({
        token: currentBooking.token,
        patientsAhead,
        estimatedMinutes
        });
    } catch (error) {
        console.error("Waiting time error:", error.message);
        res.status(500).json({
        message: "Unable to calculate waiting time"
        });
    }
    });

    

app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    console.log("PATCH API CALLED");
    const { status } = req.body;

    const allowedStatuses = [
      "Waiting",
      "Consulting",
      "Completed"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid booking status"
      });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found"
      });
    }

    // Send status update email
    console.log("STATUS EMAIL CODE REACHED");
    let emailSent = false;

    try {
      await sendQueueLessEmail({
  to: booking.email,
  subject: "Queue Less - Appointment Status Updated",
  text: `
Hello ${booking.name},

Your appointment status has been updated!

Token Number: ${booking.token}
Specialist: ${booking.specialist}
Appointment Date: ${booking.date}
Appointment Time: ${booking.time}
Current Status: ${booking.status}

Thank you for choosing Queue Less!
  `
});

      emailSent = true;
      console.log("Status update email sent to:", booking.email);

    } catch (emailError) {
      console.error("Status email failed:", emailError.message);
    }

    res.json({
      message: "Booking status updated successfully",
      booking,
      emailSent
    });

  } catch (error) {
    console.error("Status update error:", error.message);
    res.status(500).json({
      message: "Unable to update booking status"
    });
  }
});



const PORT = 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`Queue Less backend running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });
