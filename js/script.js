let professionals = [];
let currentPage = 1;
let recordsPerPage = 10;
let filteredProfessionals = [];
const excelFilePath = 'profesionales.xlsx';

document.addEventListener('DOMContentLoaded', () => {
    loadExcelFile();

    document.getElementById('recordsPerPage').addEventListener('change', updateRecordsPerPage);
    document.getElementById('search').addEventListener('input', updateProfessionals);
    document.getElementById('specialtyFilter').addEventListener('change', updateProfessionals);
    document.getElementById('prevPage').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPage').addEventListener('click', () => changePage(1));
});

function loadExcelFile() {
    fetch(excelFilePath)
        .then(response => response.arrayBuffer())
        .then(data => {
            const workbook = XLSX.read(data, { type: 'array' });
            professionals = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            populateSpecialtyFilter();
            updateProfessionals();
        })
        .catch(error => console.error('Error al leer el archivo Excel:', error));
}

function updateRecordsPerPage() {
    recordsPerPage = parseInt(document.getElementById('recordsPerPage').value);
    currentPage = 1;
    updateProfessionals();
}

function populateSpecialtyFilter() {
    const specialties = [...new Set(professionals.map(p => p.specialty))];
    const specialtyFilter = document.getElementById('specialtyFilter');
    specialtyFilter.innerHTML = '<option value="all">TODAS LAS ESPECIALIDADES</option>';

    specialties.forEach(specialty => {
        const option = document.createElement('option');
        option.value = specialty;
        option.textContent = specialty;
        specialtyFilter.appendChild(option);
    });
}

function updateProfessionals() {
    const searchQuery = document.getElementById('search').value.toLowerCase();
    const selectedSpecialty = document.getElementById('specialtyFilter').value;

    filteredProfessionals = professionals.filter(p =>
        (p.name.toLowerCase().includes(searchQuery)) &&
        (selectedSpecialty === 'all' || p.specialty === selectedSpecialty)
    );

    currentPage = 1; // Reset page to 1 whenever filters are applied
    renderProfessionals();
    updatePaginationInfo();
}

function renderProfessionals() {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const paginatedProfessionals = filteredProfessionals.slice(startIndex, startIndex + recordsPerPage);

    const professionalList = document.getElementById('professionalList');
    professionalList.innerHTML = '';

    paginatedProfessionals.forEach(professional => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${professional.specialty || ''}</td>
            <td><span class="professional-link">${professional.name || ''}</span></td>
            <td>${professional.address || ''}</td>
            <td>${professional.city || ''}</td>
            <td>${professional.phone || ''}</td>
        `;

        professionalList.appendChild(row);
    });

    // Solo agregar eventos para el pop-up en modo responsive (pantallas pequeñas)
    if (window.innerWidth <= 776) {
        document.querySelectorAll('.professional-link').forEach(link => {
            link.addEventListener('click', function () {
                const specialty = this.parentElement.previousElementSibling.textContent;
                const address = this.parentElement.nextElementSibling.textContent;
                const city = this.parentElement.nextElementSibling.nextElementSibling.textContent;
                const phone = this.parentElement.nextElementSibling.nextElementSibling.nextElementSibling.textContent;

                Swal.fire({
                    icon: 'info',
                    title: this.textContent,
                    html: `
                        <p><strong>Especialidad:</strong> ${specialty}</p>
                        <p><strong>Dirección:</strong> ${address}</p>
                        <p><strong>Localidad:</strong> ${city}</p>
                        <p><strong>Teléfono:</strong> ${phone}</p>
                    `,
                    confirmButtonText: 'Cerrar',
                    confirmButtonColor: '#7d5fff',
                    customClass: {
                        popup: 'swal2-popup-custom',
                        title: 'swal2-title-custom',
                        htmlContainer: 'swal2-html-custom'
                    }
                });
            });
        });
    }
}

function changePage(direction) {
    currentPage += direction;
    renderProfessionals();
    updatePaginationInfo();
}

function updatePaginationInfo() {
    const pageInfo = document.getElementById('pageInfo');
    const totalPages = Math.ceil(filteredProfessionals.length / recordsPerPage);

    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
}

$(document).ready(function() {
    $('#recordsPerPage').select2({
        theme: 'classic',
        width: 'resolve' // O ajustar el tamaño del selector al contenido
    });
    $('#specialtyFilter').select2({
        theme: 'classic',
        width: 'resolve'
    });
});