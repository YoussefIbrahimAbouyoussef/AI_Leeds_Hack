var button = document.getElementById("start");

button.addEventListener("click", function () {
    let names = [
        "Ali", "Sara", "John", "Maya", "Omar",
        "Lina", "David", "Noor", "Adam", "Yara",
        "Hassan", "Layla", "Ethan", "Zain", "Ava",
        "Khalid", "Mariam", "Lucas", "Fatima", "Noah"
    ];

    let genders = [
        "Male", "Female", "Male", "Female", "Male",
        "Female", "Male", "Female", "Male", "Female",
        "Male", "Female", "Male", "Male", "Female",
        "Male", "Female", "Male", "Female", "Male"
    ];

    let ages = [];
    for (let i = 0; i < names.length; i++) {
        ages.push(Math.floor(Math.random() * 70) + 10);
    }

    let ids = [];
    for (let i = 0; i < names.length; i++) {
        ids.push(i);
    }

    localStorage.setItem("Gender", JSON.stringify(genders));
    localStorage.setItem("names", JSON.stringify(names));
    localStorage.setItem("ages", JSON.stringify(ages));
    localStorage.setItem("medicalIDs", JSON.stringify(ids));

    window.location.href = "person.html";
});
