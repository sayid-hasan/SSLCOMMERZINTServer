const express = require("express");
const app = express();

const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const { default: axios } = require("axios");
require("dotenv").config();
const port = 5000 || process.env.PORT;
// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.grteoyu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// unique transaction id function
const generateTransactionId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let transactionId = "";
  const length = 8;

  for (let i = 0; i < length; i++) {
    transactionId += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `TXN-${transactionId}`;
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)need to comment before deploy next 2 lines
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    // DATABASE
    const payments = client.db("ssl").collection("payments");

    // step 1--
    // 1.1. Send a post  request to (https://sandbox.sslcommerz.com/gwprocess/v4/api.php) SSLCOMMERZ to initiate payment process and send data initial payment
    //
    // 1.2. After receiving response from SSLCOMMERZ, redirect customer to their payment gateway from response.data.GatewayPageURL/ send it on client side
    //
    // step 2--
    // 2.1. save customer details to your database and make status as pending in your database
    //
    // 2.2. after customer payment completed successfully, customer will be redirected to success_url. then update status as success in your database

    // create payment api route

    app.post("/create-payment", async (req, res) => {
      const payment_data = req?.body;
      const initialPayment = {
        // ebabe client theke amount neoa uchit na , server theke niba security er jonno . mane card er jinis sob server e rekhe okan theke total amount hisab korba

        store_id: process.env.STORE_ID,
        store_passwd: process.env.STORE_PASS,
        total_amount: payment_data?.amount,
        currency: payment_data?.currency,
        tran_id: generateTransactionId(), // use unique tran_id for each api call
        success_url: "http://localhost:5000/success-payment",
        fail_url: "http://localhost:5000/failed-Payment",
        cancel_url: "http://localhost:5000/cancel-Payment",
        ipn_url: "http://localhost:3030/ipn",

        product_name: "Computer.",
        product_category: "Electronic",
        product_profile: "general",
        cus_name: "Customer Name",
        cus_email: "customer@example.com",
        cus_add1: "Dhaka",
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: "1000",
        cus_country: "Bangladesh",
        cus_phone: "01711111111",
        cus_fax: "01711111111",
        shipping_method: "NO",
      };
      // post request using axios for http request
      const response = await axios({
        method: "POST",
        url: "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: initialPayment,
      });
      const saveData = {
        cus_name: initialPayment.cus_name,
        payment_id: initialPayment.tran_id,
        payment: initialPayment?.total_amount,
        currency: initialPayment?.currency,
        status: "pending",
      };
      const save = await payments.insertOne(saveData);
      if (save) {
        console.log("Response: ", response.data?.GatewayPageURL);
        res.send({ paymentURL: response.data?.GatewayPageURL });
      }
      // console.log("Payment data: ", payment_data);
      // console.log("initial payment: ", initialPayment);
    });
    // SUCCESS PAYMENT URL
    app.post("/success-payment", async (req, res) => {
      const success_data = req?.body;
      // console.log("Success data: ", success_data);
      // Throw an error if the transaction status is not valid
      if (success_data.status !== "VALID") {
        throw new Error("Invalid transaction . unauthorised transaction");
      }
      // update payment status in database by filtering based on trx_id
      const query = { payment_id: success_data.tran_id };
      const updateData = { $set: { status: "success" } };
      const update = await payments.updateOne(query, updateData);
      console.log("suuccess Data", success_data);
      console.log("update data", update);
      if (update.modifiedCount > 0) {
        console.log("Payment successful!");
      } else {
        console.log("Payment failed!");
      }
      res.redirect("http://localhost:5173/successPayment");
    });
    // will be called after the transaction is failed
    app.post("/failed-Payment", async (req, res) => {
      res.redirect("http://localhost:5173/failedPayment");
    });
    // will be called after the transaction is cancelled by customer
    app.post("/cancel-Payment", async (req, res) => {
      res.redirect("http://localhost:5173/cancelPayment");
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ssl commerz Int server is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
